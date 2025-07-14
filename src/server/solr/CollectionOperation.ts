import { SolrRequest } from "./SolrRequest"
import { Readable } from "stream"
import { CollectionAction } from "../types/solr"

type RouterName = "compositeId" | "implicit";

export class CollectionOperation extends SolrRequest {
  private _action!: CollectionAction
  private _name: string = ""
  private _routerName: RouterName = "compositeId"
  private _numShards?: number
  private _shards?: number
  private _collectionConfigName?: string
  private readonly _wt = "json"

  constructor() {
    super()
  }

  /**
   * @param {string} name : name of collection that should be created
   * @param {string} config : name of configset that should be used
   */
  public prepareCreate(collectionName: string, config: string): this {
    this._action = CollectionAction.CREATE
    this._name = collectionName
    this._collectionConfigName = config    
    return this
  }

  /**
   * @param name name of collection that should be deleted
   */
  public prepareDelete(collectionName: string): this {
    this._action = CollectionAction.DELETE
    this._name = collectionName
    return this
  }

  public preparePing(collectionName: string): this {
    this._action = CollectionAction.PING
    this._name = collectionName
    return this
  }

  public routerName(name: RouterName): this {
    this._routerName = name
    return this
  }

  public collectionConfigName(configName: string): this {
    this._collectionConfigName = configName
    return this
  }

  public numShards(amount: number): this {
    this._numShards = amount
    return this
  }

  public shards(amount: number): this {
    this._shards = amount
    return this
  }

  protected httpQueryParams(): Record<string, string | number | boolean> {
    // For DELETE action, no further checks required
    if (!this._name) {
      throw new Error("Collection name is required.")
    }

    const params: Record<string, string | number | boolean> = {
      wt: this._wt,
    }

    switch (this._action) {
      case CollectionAction.CREATE:
        if (!this._name) {
          throw new Error(
            "Collection name and config must be provided for CREATE.",
          )
        }

        params.action = "CREATE"
        params.name = this._name

        // Router config
        if (this._routerName) {
          params["router.name"] = this._routerName

          if (this._routerName === "compositeId") {
            if (this._numShards == null) {
              throw new Error("numShards is required for compositeId router.")
            }
            params["numShards"] = this._numShards
          } else if (this._routerName === "implicit") {
            if (!this._shards) {
              throw new Error("shards is required for implicit router.")
            }
            params["shards"] = this._shards
          }
        }

        // Optional config
        if (this._collectionConfigName) {
          params["collection.configName"] = this._collectionConfigName
        }

        break

      case CollectionAction.DELETE:
        if (!this._name) {
          throw new Error("Collection name must be provided for DELETE.")
        }
        params.action = "DELETE"
        params.name = this._name
        break

      case CollectionAction.LIST:
        params.action = "LIST"
        break

      case CollectionAction.PING:
        // No extra parameters needed, only `wt=json` is fine
        break

      default:
        throw new Error(`Unsupported action: ${this._action}`)
    }

    if (this._action === "CREATE") {
      params["router.name"] = this._routerName
      if (this._routerName === "compositeId") {
        if (this._numShards == null) {
          throw new Error("numShards is required for compositeId router.")
        }
        params["numShards"] = this._numShards
      } else if (this._routerName === "implicit") {
        if (this._shards == null) {
          throw new Error("shards is required for implicit router.")
        }
        params["shards"] = this._shards
      }
      if (this._collectionConfigName) {
        params["collection.configName"] = this._collectionConfigName
      }
    }

    return params
  }

  protected httpBody(): Readable {
    // Not used with GET method
    return null as unknown as Readable
  }

  protected absolutePath(): string {
    switch (this._action) {
      case CollectionAction.PING:
        if (!this._name) {
          throw new Error("Collection name must be specified for PING")
        }
        return `/${this._name}/admin/ping`
      case CollectionAction.CREATE:
      case CollectionAction.DELETE:
      case CollectionAction.LIST:
        return "/admin/collections"
      default:
        throw new Error("Unsupported or missing action")
    }
  }

  protected httpMethod(): "GET" | "POST" {
    return "GET"
  }

  protected httpHeaders(): { "content-type"?: string } {
    return {}
  }
}
