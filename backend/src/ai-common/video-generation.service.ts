import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CreateVideoResponse {
  id?: string;
}

interface VideoProjectStatus {
  status?: string;
  downloads?: { url?: string }[];
  error?: { message?: string } | string;
}

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

// Magic Hour's API (api.magichour.ai), not Azure Sora — Azure's sora-2 deployment is scheduled
// to shut down 2026-09-24 with no announced successor, and independent benchmarks put Kling 3.0
// ahead specifically on facial realism/consistency, the deciding requirement here. However the
// free API tier this currently runs on returns 402 plan_upgrade_required for both "kling-3.0"
// and any resolution above 480p — confirmed live against the real key, not assumed — so MODEL
// and RESOLUTION default to what the free tier actually allows (unset model = Magic Hour's own
// default, currently ltx-2.5; 480p) until the account is upgraded. Bump MAGIC_HOUR_MODEL to
// "kling-3.0" and MAGIC_HOUR_RESOLUTION to "1080p" in .env once that happens — no code change.
// audio is NOT tier-gated (confirmed live) — it just costs more credits per render (roughly
// 1.5-2x). Defaults off to conserve the free tier's limited credits until there's paying client
// revenue to justify the spend (2026-09-19 decision). Set MAGIC_HOUR_AUDIO="true" to enable —
// no code change needed.
const DEFAULT_RESOLUTION = '480p';
const DEFAULT_ASPECT_RATIO = '9:16';

@Injectable()
export class VideoGenerationService {
  constructor(private config: ConfigService) {}

  /** Runs a Magic Hour text-to-video job to completion and returns raw video bytes. */
  async generateVideo(prompt: string, durationSec: number): Promise<Buffer> {
    // Kill switch — off by default (2026-09-19 decision: no paying clients yet, and the free
    // tier's credits are nearly exhausted, so a real user clicking Export would just hit a
    // confusing insufficient-credits failure). Set VIDEO_EXPORT_ENABLED="true" once there's
    // client revenue to fund a paid Magic Hour plan.
    if (this.config.get<string>('VIDEO_EXPORT_ENABLED') !== 'true') {
      throw new ServiceUnavailableException('Video export isn\'t available yet — check back soon.');
    }

    const key = this.config.getOrThrow<string>('MAGIC_HOUR_API_KEY');
    const model = this.config.get<string>('MAGIC_HOUR_MODEL');
    const resolution = this.config.get<string>('MAGIC_HOUR_RESOLUTION') ?? DEFAULT_RESOLUTION;
    const audio = this.config.get<string>('MAGIC_HOUR_AUDIO') === 'true';
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };

    let createRes: Response;
    try {
      createRes = await fetch('https://api.magichour.ai/v1/text-to-video', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          style: { prompt },
          end_seconds: durationSec,
          ...(model ? { model } : {}),
          resolution,
          aspect_ratio: DEFAULT_ASPECT_RATIO,
          audio,
        }),
      });
    } catch {
      throw new BadGatewayException('Could not reach the AI video service. Please try again.');
    }
    if (!createRes.ok) {
      throw new BadGatewayException(`AI video service request failed (${createRes.status}). Please try again.`);
    }
    const created = (await createRes.json()) as CreateVideoResponse;
    if (!created.id) {
      throw new BadGatewayException('The AI video service did not return a project id. Please try again.');
    }

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let downloadUrl: string | undefined;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      let pollRes: Response;
      try {
        pollRes = await fetch(`https://api.magichour.ai/v1/video-projects/${created.id}`, { headers });
      } catch {
        throw new BadGatewayException('Could not reach the AI video service. Please try again.');
      }
      if (!pollRes.ok) {
        throw new BadGatewayException(`AI video service request failed (${pollRes.status}). Please try again.`);
      }
      const project = (await pollRes.json()) as VideoProjectStatus;
      if (project.status === 'complete') {
        downloadUrl = project.downloads?.[0]?.url;
        break;
      }
      if (project.status === 'error' || project.status === 'canceled') {
        const reason = typeof project.error === 'string' ? project.error : project.error?.message;
        throw new BadGatewayException(
          `AI video generation ${project.status}${reason ? `: ${reason}` : '.'}`,
        );
      }
      // otherwise still queued/rendering — keep polling
    }
    if (!downloadUrl) {
      throw new BadGatewayException('AI video generation timed out. Please try again.');
    }

    let contentRes: Response;
    try {
      contentRes = await fetch(downloadUrl);
    } catch {
      throw new BadGatewayException('Could not reach the AI video service. Please try again.');
    }
    if (!contentRes.ok) {
      throw new BadGatewayException(`AI video service request failed (${contentRes.status}). Please try again.`);
    }
    return Buffer.from(await contentRes.arrayBuffer());
  }
}
