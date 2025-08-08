import { ctr } from '@noble/ciphers/aes.js'
import {fromBinary} from '@bufbuild/protobuf'
import * as protobufs from '@meshtastic/protobufs'

export function tryDecryptPacket(pkt, channel_key){

  let view = new DataView(pkt.buffer)
  const nonce = new ArrayBuffer(16)
  const nonceView = new DataView(nonce)

  nonceView.setUint32( 0, view.getUint32(8) ) // packetid - first 8bytes of nonce
  nonceView.setUint32( 8, view.getUint32(4) ) // fromNode - 4bytes
  nonceView.setUint32( 12, 0 )                // extraNonce - 4bytes - set to all 0x0 if not included


  try{
    const plaintext = ctr(channel_key, new Uint8Array(nonceView.buffer)).decrypt( pkt.slice(16) )
    let payload = fromBinary(protobufs.Mesh.DataSchema, plaintext)

    return payload
  } catch (err){
    return null
  }

}