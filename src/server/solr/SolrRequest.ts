import axios from "axios";
import qs from "qs";
import config from "../conf/conf";

function getSolrBaseUrl(): string {
  const host = process.env.SOLR_HOST ?? config.solr.host ?? "127.0.0.1";
  const port = Number(process.env.SOLR_PORT ?? config.solr.port ?? 8983);
  return `http://${host}:${port}/solr`;
}

export abstract class SolrRequest {
  /**
   * The path that should be called on the endpoint
   */
  protected abstract absolutePath(): string;

  /**
   * The http headers that should be send with the request
   */
  protected abstract httpHeaders(): Record<string, string>;

  /**
   * The http method that should be used to send request to server
   */
  protected abstract httpMethod(): "GET" | "POST";

  protected abstract httpQueryParams(): Record<
    string,
    string | number | boolean | string[]
  >;

  protected abstract httpBody(): unknown;

  public async execute<T = unknown>(
    baseUrl: string = getSolrBaseUrl(),
  ): Promise<T> {
    const url = `${baseUrl}${this.absolutePath()}`;
    const method = this.httpMethod();
    const headers = this.httpHeaders();
    const params = this.httpQueryParams();
    const data = method === "POST" ? this.httpBody() : undefined;

    try {
      const response = await axios.request({
        url,
        method,
        headers,
        params,
        paramsSerializer: (p) =>
          qs.stringify(p, { arrayFormat: "repeat", encode: true }),
        data,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        config.warn?.(
          "❌ Solr request failed:",
          error.response?.data || error.message,
        );
        throw error;
      } else {
        throw error;
      }
    }
  }
}
