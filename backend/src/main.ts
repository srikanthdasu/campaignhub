import { ConfigService } from '@nestjs/config';
import { createApp } from './create-app.js';

async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService);
  await app.listen(config.get<number>('PORT', 3001));
}
await bootstrap();
