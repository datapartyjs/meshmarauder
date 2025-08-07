import * as fs from 'fs'
import * as readline from 'readline'
import {fromBinary, toBinary} from '@bufbuild/protobuf'
import * as protobufs from '@meshtastic/protobufs'
import { parentTypes } from '@bufbuild/protobuf/reflect'

const PortNumToProtoBuf = {
  0: null,  //ENCODING: binary undefined
  1: null, //UTF-8 Plaintext (?)
  2: protobufs.Mesh.NodeRemoteHardwarePinSchema,
  3: protobufs.Mesh.PositionSchema,
  4: protobufs.Mesh.UserSchema,
  5: protobufs.Mesh.RoutingSchema,
  6: protobufs.Admin.AdminMessageSchema,
  7: null, //UTF-8 Plaintext (?) with Unishox2 Compression
  8: protobufs.Mesh.WaypointSchema,
  9: null, //Encapsulated codec2 packets. On 2.4 GHZ Bandwidths only for now
  10: null,
  12: protobufs.Mesh.KeyVerificationSchema,
  // Provides a 'ping' service that replies to any packet it receives.
	// Also serves as a small example module.
	// ENCODING: ASCII Plaintext
  32: null, 
  // Provides a format to send and receive telemetry data from the Meshtastic network.
	// Maintained by Charles Crossan (crossan007) : crossan007@gmail.com
	// ENCODING: Protobuf
  67: null, //Telemetry
  73: null  //Map report
}

// https://meshtastic.org/docs/overview/encryption/

let enc_count = 0
let not_enc_count = 0
let mqtt = 0
let not_mqtt = 0

async function main() {
  const fileName = '/home/null/data/defcon-msg1.txt';


  const fileStream = fs.createReadStream(fileName)

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input.txt as a single line break.

  for await (const line of rl) {
    //console.log(`Line from file: ${line}`);

    let lineCleaned = line.trim().replace('RAW: ', '')
    const pkt = Uint8Array.from(Buffer.from(lineCleaned, 'hex'))

    if(pkt.length == 0) {
      continue;
    }


    let short = false
    let parsedPacket = {}
    let view = new DataView(pkt.buffer)

    if(pkt.length >= 4){ parsedPacket.addrTo = view.getUint32(0) } else {short=true}
    if(pkt.length >= 8) { parsedPacket.addrFrom = view.getUint32(4) } else {short=true}
    if(pkt.length >= 12) { parsedPacket.pktId = view.getUint32(8) } else {short=true}
    if(pkt.length >= 13) { 
      parsedPacket.flagsByte = view.getUint8(12)
      parsedPacket.flags = {
        hop_limit: parsedPacket.flagsByte & 0x7,
        want_ack: (parsedPacket.flagsByte & 0x8) >> 3,
        via_mqtt: (parsedPacket.flagsByte & 0x10) >> 4,
        hop_start:(parsedPacket.flagsByte & 0xE0) >> 5
  
      }

      if(parsedPacket.flags.via_mqtt){
        mqtt++
      } else { not_mqtt++ }
    } else {short=true}
    if(pkt.length >= 14) { parsedPacket.channel = view.getUint8(13) } else {short=true}
    if(pkt.length >= 15) { parsedPacket.next_hop = view.getUint8(14) } else {short=true}
    if(pkt.length >= 16) { parsedPacket.relay_node = view.getUint8(15) } else {short=true}

    if(!short){

      try{

        parsedPacket.payload = fromBinary(protobufs.Mesh.DataSchema, pkt.slice(16))
        parsedPacket.encrypted = false
        not_enc_count++

        //process.exit()
      } catch (err){
        //encrypted

        /* PKI decrypt, loops over user keys

         if (crypto->decryptCurve25519(
         p->from,
         nodeDB->getMeshNode(p->from)->user.public_key,
         p->id,
         rawSize,
         p->encrypted.bytes,
         bytes)) {*/

        //         

        parsedPacket.encrypted = true
        enc_count++
      }

    
 

      if(!parsedPacket.encrypted){

          if(parsedPacket.payload.portnum != 0){

            let scheme = PortNumToProtoBuf[ parsedPacket.payload.portnum ]

            if(scheme != null && scheme != undefined){

              parsedPacket.data = fromBinary(scheme, parsedPacket.payload.payload)
              delete parsedPacket.payload.payload

              if( parsedPacket.data['$typeName'] == 'meshtastic.User' && parsedPacket.data.publicKey.length > 0){

                console.log(parsedPacket)
              }

            }


          }
      }

    }
    console.log(parsedPacket)
    
  }

  console.log('mqtt:', mqtt, '  not-mqtt:', not_mqtt, ' enc:', enc_count, ' not-enc:', not_enc_count)
}

main();



