import DefaultTheme from "vitepress/theme";
import CopyPageButton from "./CopyPageButton.vue";
import { h } from "vue";

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "doc-after": () => h(CopyPageButton),
    });
  },
};
