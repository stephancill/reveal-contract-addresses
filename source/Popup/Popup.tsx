import React, { useEffect } from 'react';
import {browser} from 'webextension-polyfill-ts';
import usePromise from '../hooks/usePromise';
import { IAddressItem } from '../interfaces/IAddressItem';
import { getHostFromURL } from '../utils';

import './styles.scss';

// function openWebPage(url: string): Promise<Tabs.Tab> {
//   return browser.tabs.create({url});
// }

async function getAddressesWithNames(): Promise<IAddressItem[]> {
  let activeTab = (await browser.tabs.query({active: true}))[0]
  let host = getHostFromURL(activeTab.url || "")
  const storage = await browser.storage.local.get([host])
  const addressItems = storage[host] as IAddressItem[]
  console.log("addressItems", addressItems)
  const addressesWithNames = await getContractNames(addressItems)
  console.log("addressesWithNames", addressesWithNames)
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
      const itemsForBatch = tasks.slice(position, position + batchSize);
      console.log("items", itemsForBatch.length)
      const _results = [...results, ...await Promise.all([...itemsForBatch.map(item => f(item)), delay(delayMilliseconds)])];
      results = _results.slice(0, _results.length-1) as T[]
      position += batchSize;
  }
  return results;
}

// Update storage after each
async function getContractName(address: string): Promise<string | undefined>  {
  const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${""}`
  const res = await fetch(url)
  if (res.ok) {
    const json = await res.json()
    console.log(json)
    return json.result[0].ContractName as string
  }

  return undefined
}

async function getContractNames(addressItems: IAddressItem[]): Promise<IAddressItem[]> {
  console.log("aaaaaaa", [addressItems.map(i => i.address)])
  const storage = await browser.storage.local.get([...addressItems.map(i => i.address)])
  console.log("storage", storage)
  // return addressItems
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
  const requestsPerSecond = 1

  const contractNames = await promiseAllInBatches<string | undefined>(getContractName, tasks, requestsPerSecond, 5500)

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
    console.log(addressItems)
  }, [addressItems])
  
  return (
    <section id="popup">
      {!addressesWithNames ? addressItems && addressItems.sort((a, b) => (a.name || "") > (b.name || "") ? -1 : 1).map(i => {
        return <div key={i.address}>{i.name} {i.address}</div>
      })
      :
      addressesWithNames.filter(i => i.name).sort((a, b) => (a.name || "") > (b.name || "") ? -1 : 1).map(i => {
        return <div key={i.address}>{i.name} {i.address}</div>
      })
    }
    </section>
  );
};