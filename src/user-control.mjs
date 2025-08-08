import { ed25519 } from '@noble/curves/ed25519.js';
import hkdf from '@panva/hkdf'

export class UserControl {

  constructor({
    longName, shortName, macaddr,
    hwModel, role=0, publicKey,
    isUnmessagable=false, isLicensed=false
  }){

    this.data = {}
    this.marauderKey = null

    /**
     *     id: '!0c578b20',
          longName: 'Felix Atter mod',
          shortName: 'FeLX',
          macaddr: Uint8Array(6) [ 220, 218, 12, 87, 139, 32 ],
          hwModel: 50,
          isLicensed: false,
          role: 0,
          publicKey: Uint8Array(32) [
            186,  49,  64, 180, 154, 146, 178, 180,
            65, 136, 149, 212, 172, 251,  99,  52,
            46, 105, 186, 115, 189,  90,   4,  70,
            181, 170, 254,  14, 130,  80,   3,  38
          ],
          isUnmessagable: false

     */
  }

  genKey(){
    if(this.marauderKey != null){ return }

    const { secretKey, publicKey } = ed25519.keygen


    let seed = await hkdf('sha512',new Uint8Array(4), new Uint8Array(32), '', 32)

const theKey = ed25519.keygen(seed)
console.log(theKey)
  }

  fromLorapipePacket(packet){

  }
}