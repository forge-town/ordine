import { type CapabilitySourceId } from "@repo/schemas";
export interface ConnectorsServiceOptions {
  encryptionSecret?: string;
  env?: Readonly<Record<string, string | undefined>>;
}
export interface ConnectConnectorOptions {
  preferredSource?: CapabilitySourceId;
  sourceKey?: string;
}
