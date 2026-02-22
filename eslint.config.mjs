import coreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".claude/**"] },
  ...coreWebVitals,
];

export default eslintConfig;
