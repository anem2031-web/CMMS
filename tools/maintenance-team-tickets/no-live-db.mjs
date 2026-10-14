import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    if (
      /\/server\/_core\/(?:db\/|config\.|env\.)|\/node_modules\/(?:mysql2|dotenv)\//.test(
        result.url.replaceAll("\\", "/")
      )
    ) {
      throw new Error(
        `Live database/environment import forbidden in isolated tests: ${result.url}`
      );
    }
    return result;
  },
});
