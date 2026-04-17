import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials, Metadata, credentials } from '@grpc/grpc-js';
import type { Config } from './config.js';

export type SuiContext = {
  client: SuiGrpcClient;
  keypair: Ed25519Keypair;
  sender: string;
  transport: GrpcTransport;
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

function parseGrpcHost(url: string): { host: string; secure: boolean } {
  if (url.startsWith('http://')) {
    const rest = url.slice('http://'.length).replace(/\/.*$/, '');
    return { host: rest.includes(':') ? rest : `${rest}:80`, secure: false };
  }
  if (url.startsWith('https://')) {
    const rest = url.slice('https://'.length).replace(/\/.*$/, '');
    return { host: rest.includes(':') ? rest : `${rest}:443`, secure: true };
  }
  return { host: url.includes(':') ? url : `${url}:443`, secure: true };
}

function buildChannelCreds(secure: boolean, token: string): ChannelCredentials {
  if (!secure) return credentials.createInsecure();
  const callCreds = credentials.createFromMetadataGenerator((_ctx, cb) => {
    const md = new Metadata();
    md.set('x-token', token);
    cb(null, md);
  });
  return credentials.combineChannelCredentials(credentials.createSsl(), callCreds);
}

export function createSuiContext(cfg: Config): SuiContext {
  const { host, secure } = parseGrpcHost(cfg.grpcUrl);
  const transport = new GrpcTransport({
    host,
    channelCredentials: buildChannelCreds(secure, cfg.grpcToken),
  });
  const client = new SuiGrpcClient({ network: 'mainnet', transport });
  const keypair = keypairFromSecret(cfg.privateKey);
  return { client, keypair, sender: keypair.toSuiAddress(), transport };
}
