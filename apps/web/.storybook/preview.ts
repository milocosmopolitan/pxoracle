import type { Preview } from "@storybook/react-vite";
import "../app/style.css";
import {MINIMAL_VIEWPORTS} from "storybook/viewport";
const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    viewport:{options:{...MINIMAL_VIEWPORTS,mobile390:{name:"Mobile 390",styles:{width:"390px",height:"844px"},type:"mobile"}}},
    backgrounds: {
      default: "night",
      values: [{ name: "night", value: "#0c1212" }],
    },
  },
};
export default preview;
