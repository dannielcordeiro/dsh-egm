# `@local/dsh-egm-ui` — browser half

Registers the composer chip, the reviewer card and the EGM settings page. It reads the `egmRun` projection
and calls `/egm …` through the host command channel, so it shares one source of truth with the terminal and
never talks to the network itself.

One entry file, `src/client.js`, because the Harness Web module loader serves exactly one script per
package. Its sections are the module boundaries: helpers, chip, reviewer card, settings page.

The package declares `dsh.client.platform: "web"` and a single host row that disables itself in a profile
without `@deepseek-ai/dsh-client-modules`, so installing it in a terminal or headless profile is harmless.
