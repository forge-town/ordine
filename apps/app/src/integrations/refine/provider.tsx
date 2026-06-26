import { Refine } from "@refinedev/core";
import { type FC, type PropsWithChildren } from "react";
import { PlatformProvider } from "@repo/views/platform";
import { dataProvider } from "./dataProvider";
import { notificationProvider } from "./notificationProvider";
import { webPlatform } from "../platform";

export const RefineProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <Refine dataProvider={dataProvider} notificationProvider={notificationProvider}>
      <PlatformProvider value={webPlatform}>{children}</PlatformProvider>
    </Refine>
  );
};
