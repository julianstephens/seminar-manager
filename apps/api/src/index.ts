import { env } from "@/env";
import { setupApp } from "@/server";

const start = async () => {
  const app = await setupApp();
  try {
    await app.ready();
    await app.listen({ host: "0.0.0.0", port: env.PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
