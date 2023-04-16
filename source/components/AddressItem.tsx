import React from "react"
import { browser, Tabs } from "webextension-polyfill-ts"
import { IAddressItem } from "../interfaces/IAddressItem"
import { truncateAddress } from "../utils"

// import style from "./AddressItem.module.css"

function openWebPage(url: string): Promise<Tabs.Tab> {
  return browser.tabs.create({ url })
}

interface IAddressItemProps {
  addressItem: IAddressItem
}

export const AddressItem = ({ addressItem }: IAddressItemProps) => {
  return (
    <div>
      <a
        onClick={() => {
          openWebPage(`https://etherscan.io/address/${addressItem.address}#code`)
        }}
      >
        <strong>{addressItem.name}</strong> {truncateAddress(addressItem.address)}
      </a>
    </div>
  )
}
