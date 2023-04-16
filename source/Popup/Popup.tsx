import React, { useEffect, useState } from "react"
import { browser } from "webextension-polyfill-ts"
import { AddressItem } from "../components/AddressItem"
import usePromise from "../hooks/usePromise"
import { IAddressItem } from "../interfaces/IAddressItem"
import { getHostFromURL } from "../utils"

import "./index.css"

interface INameFetcherOption {
  requestsPerBatch: number
  batchDelayMilliseconds: number
  nameFetcher: (address: string) => Promise<string | undefined>
}

type EnumDictionary<T extends string | symbol | number, U> = {
  [K in T]: U
}

enum NameFetcher {
  api,
  scrape,
}

const nameFetcherOptions: EnumDictionary<NameFetcher, INameFetcherOption> = {
  [NameFetcher.api]: {
    requestsPerBatch: 1,
    batchDelayMilliseconds: 5500,
    nameFetcher: getContractName,
  },
  [NameFetcher.scrape]: {
    requestsPerBatch: 10,
    batchDelayMilliseconds: 1000,
    nameFetcher: scrapeContractName,
  },
}

async function getAddressesWithNames(): Promise<IAddressItem[]> {
  const addressItems = await getAddresses()
  const addressesWithNames = await getContractNames(addressItems)
  return addressesWithNames
}

async function getAddresses(): Promise<IAddressItem[]> {
  let activeTab = (await browser.tabs.query({ active: true }))[0]
  let host = getHostFromURL(activeTab.url || "")
  const storage = await browser.storage.local.get([host])
  let addressItems = storage[host] as IAddressItem[]
  addressItems = addressItems.sort((a, b) => ((a.name || "") > (b.name || "") ? -1 : 1))
  return addressItems
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function promiseAllInBatches<T>(
  f: (...args: any[]) => Promise<T>,
  tasks: any[],
  batchSize: number,
  delayMilliseconds: number,
) {
  let position = 0
  let results: T[] = []
  while (position < tasks.length) {
    console.log("position", position, "/", tasks.length)
    const itemsForBatch = tasks.slice(position, position + batchSize)
    const _results = [
      ...results,
      ...(await Promise.all([...itemsForBatch.map((item) => f(item)), delay(delayMilliseconds)])),
    ]
    results = _results.slice(0, _results.length - 1) as T[]
    position += batchSize
  }
  return results
}

async function saveContractName(address: string, name: string) {
  await browser.storage.local.set({ [address]: name })
}

// TODO: Update storage after each fetch, listen for changes
async function getContractName(address: string): Promise<string | undefined> {
  const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${""}`
  const res = await fetch(url)
  if (res.ok) {
    const json = await res.json()
    const name = json.result[0].ContractName as string
    await saveContractName(address, name)
    return name
  }
  await saveContractName(address, "")
  return undefined
}

async function scrapeContractName(address: string): Promise<string | undefined> {
  const url = `https://etherscan.io/address/${address}`
  const res = await fetch(url)
  if (res.ok) {
    const text = await res.text()
    const title = text
      .slice(text.indexOf("<title>") + "<title>".length, text.indexOf("</title>"))
      .split(" |")[0]
      .replace("\r", "")
      .replace("\t", "")
      .replace("\n", "")
    if (title.includes(address)) {
      return undefined
    }
    await saveContractName(address, title)
    return title
  }

  await saveContractName(address, "")
  return undefined
}

async function getContractNames(addressItems: IAddressItem[]): Promise<IAddressItem[]> {
  const storage = await browser.storage.local.get([...addressItems.map((i) => i.address)])
  const addressesWithNames: IAddressItem[] = []
  const addressesWithoutNames: IAddressItem[] = []

  addressItems.forEach((i) => {
    if (storage[i.address] !== undefined) {
      addressesWithNames.push({ ...i, name: storage[i.address] })
    } else {
      addressesWithoutNames.push(i)
    }
  })

  const nameFetcherOption = nameFetcherOptions[NameFetcher.api] // TODO: Settings option
  const tasks = addressesWithoutNames.map((i) => i.address)
  console.log(tasks)
  const contractNames = await promiseAllInBatches<string | undefined>(
    nameFetcherOption.nameFetcher,
    tasks,
    nameFetcherOption.requestsPerBatch,
    nameFetcherOption.batchDelayMilliseconds,
  )

  const newAddressObjects: IAddressItem[] = addressesWithoutNames.map((i, index) => ({
    address: i.address,
    name: contractNames[index],
  }))

  let activeTab = (await browser.tabs.query({ active: true }))[0]
  let host = getHostFromURL(activeTab.url || "")
  await browser.storage.local.set({
    [host]: [...addressesWithNames, ...newAddressObjects],
  })

  return [...addressesWithNames, ...newAddressObjects]
}

export const Popup = () => {
  const [addressItemsUnnamed] = usePromise<IAddressItem[]>(getAddressesWithNames, [])
  const [addressItemsNamed, addressItemsLoading] = usePromise<IAddressItem[]>(getAddressesWithNames, [])
  const [addressItems, setAddressItems] = useState<IAddressItem[]>([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (addressItemsNamed) {
      console.log("named saved", addressItemsNamed.length)
      setAddressItems(addressItemsNamed)
    } else if (addressItemsUnnamed) {
      console.log("unnamed saved", addressItemsUnnamed.length)
      setAddressItems(addressItemsUnnamed)
    }
  }, [addressItemsUnnamed, addressItemsNamed])

  return (
    <section id="popup">
      {addressItemsLoading ? (
        <div>Loading</div>
      ) : (
        addressItems && (
          <div>
            <button onClick={() => setShowAll(!showAll)}>{showAll ? "Hide unnamed" : "Show all"}</button>
            {showAll
              ? addressItems.map((i, index) => {
                  return <AddressItem key={index} addressItem={i} />
                })
              : addressItems &&
                addressItems
                  .filter((i) => i.name)
                  .map((i, index) => {
                    return <AddressItem key={index} addressItem={i} />
                  })}
          </div>
        )
      )}
    </section>
  )
}
