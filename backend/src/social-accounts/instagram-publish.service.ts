import { Injectable } from '@nestjs/common';

const GRAPH_VERSION = 'v21.0';

interface InstagramContainerResponse {
  id?: string;
  error?: { message?: string };
}

interface InstagramContainerStatusResponse {
  status_code?: 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED' | 'PUBLISHED';
  error?: { message?: string };
}

interface InstagramPublishResponse {
  id?: string;
  error?: { message?: string };
}

export class InstagramPublishError extends Error {}

const CONTAINER_POLL_INTERVAL_MS = 2000;
const CONTAINER_POLL_MAX_ATTEMPTS = 15;

@Injectable()
export class InstagramPublishService {
  /**
   * Three-step Content Publishing API: create a media container from a publicly reachable image
   * URL, wait for Instagram to finish processing it (publishing an IN_PROGRESS container fails
   * with "Media ID is not available"), then publish it. Instagram has no text-only post type —
   * a caption alone, with no image, has nothing to attach it to and can't be published this way.
   */
  async publishImage(igUserId: string, accessToken: string, imageUrl: string, caption: string): Promise<string> {
    const containerId = await this.createContainer(igUserId, accessToken, imageUrl, caption);
    await this.waitForContainerReady(containerId, accessToken);
    return this.publishContainer(igUserId, accessToken, containerId);
  }

  private async waitForContainerReady(containerId: string, accessToken: string): Promise<void> {
    for (let attempt = 0; attempt < CONTAINER_POLL_MAX_ATTEMPTS; attempt++) {
      const params = new URLSearchParams({ fields: 'status_code', access_token: accessToken });

      let res: Response;
      try {
        res = await fetch(`https://graph.instagram.com/${GRAPH_VERSION}/${containerId}?${params.toString()}`);
      } catch {
        throw new InstagramPublishError('Could not reach Instagram to check the post status.');
      }
      const data = (await res.json()) as InstagramContainerStatusResponse;

      if (data.status_code === 'FINISHED') return;
      if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
        throw new InstagramPublishError(data.error?.message ?? 'Instagram failed to process the media');
      }

      await new Promise((resolve) => setTimeout(resolve, CONTAINER_POLL_INTERVAL_MS));
    }
    throw new InstagramPublishError('Instagram took too long to process the media — try again shortly.');
  }

  private async createContainer(
    igUserId: string,
    accessToken: string,
    imageUrl: string,
    caption: string,
  ): Promise<string> {
    const params = new URLSearchParams({ image_url: imageUrl, caption, access_token: accessToken });

    let res: Response;
    try {
      res = await fetch(`https://graph.instagram.com/${GRAPH_VERSION}/${igUserId}/media`, {
        method: 'POST',
        body: params,
      });
    } catch {
      throw new InstagramPublishError('Could not reach Instagram to create the post.');
    }
    const data = (await res.json()) as InstagramContainerResponse;
    if (!data.id) {
      throw new InstagramPublishError(data.error?.message ?? 'Instagram rejected the media container');
    }
    return data.id;
  }

  private async publishContainer(igUserId: string, accessToken: string, containerId: string): Promise<string> {
    const params = new URLSearchParams({ creation_id: containerId, access_token: accessToken });

    let res: Response;
    try {
      res = await fetch(`https://graph.instagram.com/${GRAPH_VERSION}/${igUserId}/media_publish`, {
        method: 'POST',
        body: params,
      });
    } catch {
      throw new InstagramPublishError('Could not reach Instagram to publish the post.');
    }
    const data = (await res.json()) as InstagramPublishResponse;
    if (!data.id) {
      throw new InstagramPublishError(data.error?.message ?? 'Instagram rejected publishing the post');
    }
    return data.id;
  }
}
