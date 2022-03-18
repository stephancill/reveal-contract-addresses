import React, { useEffect } from 'react';
import {browser} from 'webextension-polyfill-ts';
import usePromise from '../hooks/usePromise';
import { IAddress } from '../interfaces/IAddress';
import { getHostFromURL } from '../utils';

import './styles.scss';

// function openWebPage(url: string): Promise<Tabs.Tab> {
//   return browser.tabs.create({url});
// }

async function getAddresses(): Promise<IAddress[]> {
  let activeTab = (await browser.tabs.query({active: true}))[0]
  let host = getHostFromURL(activeTab.url || "")
  const storage = await browser.storage.local.get([host])
  const addresses = storage[host] as IAddress[]
  return addresses
}

export const Popup = () => {
  const [addresses] = usePromise<IAddress[]>(getAddresses, [] )

  useEffect(() => {

  }, [addresses])
  
  return (
    <section id="popup">
      {addresses && addresses.sort((a, b) => a.address > b.address ? -1 : 1).map(i => {
        return <div key={i.address}>{i.address}</div>
      })}
    </section>
  );
};