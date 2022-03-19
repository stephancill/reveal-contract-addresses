import React from "react"
import { IAddressItem } from "../interfaces/IAddressItem"

interface IAddressItemProps {
    addressItem: IAddressItem
}

export const AddressItem = ({addressItem}: IAddressItemProps) => {
    return <div>{addressItem.name} {addressItem.address}</div>
}