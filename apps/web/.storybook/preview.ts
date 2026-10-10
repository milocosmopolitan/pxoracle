import type { Preview } from "@storybook/react-vite";
import "../app/style.css";
const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "night",
      values: [{ name: "night", value: "#0c1212" }],
    },
  },
};
export default preview;
