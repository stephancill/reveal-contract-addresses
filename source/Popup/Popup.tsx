import React, { useEffect } from 'react';
import {browser} from 'webextension-polyfill-ts';
import { AddressItem } from '../components/AddressItem';
import usePromise from '../hooks/usePromise';
import { IAddressItem } from '../interfaces/IAddressItem';
import { getHostFromURL } from '../utils';

import "./index.css"

interface INameFetcherOption {
  requestsPerBatch: number
  batchDelayMilliseconds: number
  nameFetcher: (address: string) => Promise<string|undefined>
}

type EnumDictionary<T extends string | symbol | number, U> = {
  [K in T]: U;
};

enum NameFetcher {
  api,
  scrape
}

const nameFetcherOptions: EnumDictionary<NameFetcher, INameFetcherOption> = {
  [NameFetcher.api]: {
    requestsPerBatch: 1,
    batchDelayMilliseconds: 5500,
    nameFetcher: getContractName
  },
  [NameFetcher.scrape]: {
    requestsPerBatch: 10,
    batchDelayMilliseconds: 1000,
    nameFetcher: scrapeContractName
  }
}

async function getAddressesWithNames(): Promise<IAddressItem[]> {
  const addressItems = await getAddresses()
  const addressesWithNames = await getContractNames(addressItems)
  return addressesWithNames
}

async function getAddresses(): Promise<IAddressItem[]> {
  let activeTab = (await browser.tabs.query({active: true}))[0]
  let host = getHostFromURL(activeTab.url || "")
  const storage = await browser.storage.local.get([host])
  const addressItems = storage[host] as IAddressItem[]
  return addressItems
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function promiseAllInBatches<T>(f: (...args: any[]) => Promise<T>, tasks: any[], batchSize: number, delayMilliseconds: number) {
  let position = 0;
  let results: T[] = [];
  while (position < tasks.length) {
    console.log("position", position)
    const itemsForBatch = tasks.slice(position, position + batchSize);
    const _results = [...results, ...await Promise.all([...itemsForBatch.map(item => f(item)), delay(delayMilliseconds)])];
    results = _results.slice(0, _results.length-1) as T[]
    position += batchSize;
  }
  return results;
}

// TODO: Update storage after each fetch, listen for changes
async function getContractName(address: string): Promise<string | undefined>  {
  const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${""}`
  const res = await fetch(url)
  if (res.ok) {
    const json = await res.json()
    return json.result[0].ContractName as string
  }
  return undefined
}

async function scrapeContractName(address: string): Promise<string | undefined> {
  const url = `https://etherscan.io/address/${address}`
  const res = await fetch(url)
  if (res.ok) {
    const text = await res.text()
    const title = text.slice(text.indexOf("<title>")+"<title>".length, text.indexOf("</title>")).split(" |")[0].replace("\r", "").replace("\t", "").replace("\n", "")
    if (title.includes(address)) {
      return undefined
    }
    return title
  }

  return undefined
}

async function getContractNames(addressItems: IAddressItem[]): Promise<IAddressItem[]> {
  const storage = await browser.storage.local.get([...addressItems.map(i => i.address)])
  const addressesWithNames: IAddressItem[] = []
  const addressesWithoutNames: IAddressItem[] = []

  addressItems.forEach(i => {
    if (storage[i.address] !== undefined) {
      addressesWithNames.push({...i, name: storage[i.address]})
    } else {
      addressesWithoutNames.push(i)
    }
  })

  const tasks = addressesWithoutNames.map(i => i.address)

  const nameFetcherOption = nameFetcherOptions[NameFetcher.scrape] // TODO: Settings option

  const contractNames = await promiseAllInBatches<string | undefined>(nameFetcherOption.nameFetcher, tasks, nameFetcherOption.requestsPerBatch, nameFetcherOption.batchDelayMilliseconds)

  const newAddressObjects: IAddressItem[] = addressesWithoutNames.map((i, index) => ({address: i.address, name: contractNames[index]}))

  const addressToName: {[key: string]: string | undefined} = {}
  newAddressObjects.forEach(i => {
    addressToName[i.address] = i.name
  })

  await browser.storage.local.set(addressToName)

  return [...addressesWithNames, ...newAddressObjects]
}

export const Popup = () => {
  const [addressItems] = usePromise<IAddressItem[]>(getAddresses, [] )
  const [addressesWithNames] = usePromise<IAddressItem[]>(getAddressesWithNames, [] )

  useEffect(() => {

  }, [addressItems, addressesWithNames])
  // TODO: Not displaying addresses with names immediately after first load
  return (
    <section id="popup">
      {!addressesWithNames ? addressItems && addressItems.sort((a, b) => (a.name || "") > (b.name || "") ? -1 : 1).map((i, index) => {
        return <AddressItem key={index} addressItem={i}/>
      })
      :
        addressesWithNames.filter(i => i.name).length === 0 ? 
        <div>No named addresses detected</div> 
        :
        addressesWithNames.filter(i => i.name).sort((a, b) => (a.name || "") > (b.name || "") ? -1 : 1).map((i, index) => {
          return <AddressItem key={index} addressItem={i}/>
        })
    }
    {!addressItems && <div>Something went wrong</div>}
    </section>
  );
};