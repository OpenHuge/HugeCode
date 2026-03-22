#!/usr/bin/env node

import lintStaged from "lint-staged";
import config from "../lint-staged.config.mjs";

const passed = await lintStaged({
  config,
});

if (!passed) {
  process.exitCode = 1;
}
