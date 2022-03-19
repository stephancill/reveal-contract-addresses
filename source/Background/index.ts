import {browser, WebRequest } from 'webextension-polyfill-ts';
import {ethers} from "ethers"
import { IAddressItem } from '../interfaces/IAddressItem';
import { getHostFromURL } from '../utils';


const loaded: {[key: string]: boolean} = {}
const addresses: {[key: string]: IAddressItem[]} = {}
const maxAddresses = 20 // TODO: Settings page

function shouldIncludeAddress(address: string, initiator: string) {
  const isAddress = ethers.utils.isAddress(address)
  if (!isAddress) return false

  address = ethers.utils.getAddress(address)

  const isZeroAddress = address === ethers.constants.AddressZero
  if (isZeroAddress) return false

  const alreadyIncluded = addresses[initiator].filter(i => i.address === address).length != 0
  if (alreadyIncluded) return false

  return true
}

async function logURL(requestDetails: WebRequest.OnCompletedDetailsType) {
  const {url, initiator} = requestDetails

  if (!initiator) return
  const host = getHostFromURL(initiator)

  if (!loaded[url]) {
    loaded[url] = true
    if (!addresses[host]) {
      addresses[host] = []
    }
    
    const resp = await fetch(url)
    const blob = await resp.blob()
    const text = await blob.text()

    let lastIndex: number = text.indexOf("0x")

    while(lastIndex != -1) {
      // TODO: Detect context of address e.g. array or dictionary and have option to ignore contexts
      // TODO: Handle different chains
      // TODO: Count occurances
      const addr = text.slice(lastIndex, lastIndex+42)
      if (shouldIncludeAddress(addr, host)) {
        console.log(host, addr, addresses[host].length)
        addresses[host].push({address: ethers.utils.getAddress(addr)})
        if (addresses[host].length > maxAddresses) {
          break
        }
        browser.storage.local.set({[host]: addresses[host]})
      }
      lastIndex = text.indexOf("0x", lastIndex+1)
    }
  }
}

browser.webRequest.onCompleted.addListener(
  logURL,
  {urls: ['*://*/*.js', '*://*/*.js?*', '*://*/*.json', '*://*/*.json?*']}
)

