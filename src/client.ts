import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import type { Config } from './config.js';

export type SuiContext = {
  client: SuiGrpcClient;
  keypair: Ed25519Keypair;
  sender: string;
  transport: GrpcWebFetchTransport;
};

function keypairFromSecret(secret: string): Ed25519Keypair {
  if (secret.startsWith('suiprivkey')) {
    const { schema, secretKey } = decodeSuiPrivateKey(secret);
    if (schema !== 'ED25519') {
      throw new Error(`Unsupported key schema: ${schema}; only ED25519 supported`);
    }
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  const hex = secret.startsWith('0x') ? secret.slice(2) : secret;
  const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
  return Ed25519Keypair.fromSecretKey(bytes);
}

export function createSuiContext(cfg: Config): SuiContext {
  const transport = new GrpcWebFetchTransport({
    baseUrl: cfg.grpcUrl,
    meta: { 'x-token': cfg.grpcToken },
  });
  const client = new SuiGrpcClient({ network: 'mainnet', transport });
  const keypair = keypairFromSecret(cfg.privateKey);
  return { client, keypair, sender: keypair.toSuiAddress(), transport };
}
