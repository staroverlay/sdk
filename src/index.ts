export * from "./emitter";
export * from "./sdk";
export * from "./types";
export * from "./chat";

import { StarOverlaySDK } from "./sdk";

const sdk = new StarOverlaySDK();
if (typeof window !== 'undefined') {
    (window as any).StarOverlay = sdk;
}
export default sdk;