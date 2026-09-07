import { Injectable } from '@nestjs/common';

const GRAPH_VERSION = 'v21.0';

interface InstagramContainerResponse {
  id?: string;
  error?: { message?: string };
}

interface InstagramPublishResponse {
  id?: string;
  error?: { message?: string };
}

export class InstagramPublishError extends Error {}

@Injectable()
export class InstagramPublishService {
  /**
   * Two-step Content Publishing API: create a media container from a publicly reachable image
   * URL, then publish that container. Instagram has no text-only post type — a caption alone,
   * with no image, has nothing to attach it to and can't be published this way.
   */
  async publishImage(igUserId: string, accessToken: string, imageUrl: string, caption: string): Promise<string> {
    const containerId = await this.createContainer(igUserId, accessToken, imageUrl, caption);
    return this.publishContainer(igUserId, accessToken, containerId);
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
