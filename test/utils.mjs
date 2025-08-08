import { ctr } from '@noble/ciphers/aes.js'
import {fromBinary, toBinary} from '@bufbuild/protobuf'
import * as protobufs from '@meshtastic/protobufs'


/**
 * 
 * @param {Uint8Array} pkt 
 * @param {Uint8Array} channel_key
 * @param {Uint8Array} extraNonce 4 bytes long
 * @returns 
 */
export function tryDecryptChannelPacket(pkt, channel_key, extraNonce=null){

  if(extraNonce == null){
    extraNonce = new DataView( new ArrayBuffer(4) )
    extraNonce.setUint32(0, 0)
  }

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

/**
 * 
 * @param {Uint8Array} channel_key
 * @param {Uint8Array} payload 
 * @param {Uint8Array} from  4 bytes long
 * @param {Uint8Array} extraNonce 4 bytes long
 */
export function encryptChannelPacket(channel_key, payload, from, extraNonce=null){

  const nonce = new ArrayBuffer(16)
  const nonceView = new DataView(nonce)
  const fromView = new DataView(from)

  nonceView.setUint32( 0, view.getUint32(8) )
  nonceView.setUint32( 8, view.getUint32(4) )
  nonceView.setUint32( 12, extraNonce.getUint32(0))

  const ciphertext = ctr(channel_key, )

}

/* PKI decrypt, loops over user keys

  if (crypto->decryptCurve25519(
  p->from,
  nodeDB->getMeshNode(p->from)->user.public_key,
  p->id,
  rawSize,
  p->encrypted.bytes,
  bytes)) {
*/
