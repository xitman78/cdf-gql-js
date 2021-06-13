import { ApolloServer, gql } from "apollo-server";
import { Asset, CogniteEvent, Timeseries } from "@cognite/sdk";
import { cogniteClient } from "./cognite-client";
import { chunk, flatten } from "lodash";
import DataLoader from "dataloader";

const typeDefs = gql`
  type Asset {
    id: ID!
    name: String
    timeseries: [Timeseries]
    parentAsset: Asset
    childrenAssets: [Asset]
    events: [Event]
  }

  type Timeseries {
    id: ID!
    externalId: String
  }

  type Event {
    id: ID!
    description: String
    actionLevel: String
    startTime: String
    endTime: String
  }

  type Query {
    assets: [Asset]
    assetByName(name: String!): Asset
  }
`;

const resolvers = {
  Query: {
    assets: () =>
      cogniteClient.assets.list({ limit: 20 }).then((res) => res.items),

    assetByName: (parent: any, args: any, context: any, info: any) =>
      cogniteClient.assets
        .retrieve([{ externalId: args.name }])
        .then((res) => res[0]),
  },

  Asset: {
    timeseries: (asset: Asset, args: any, context: any) =>
      context.dataloaders.timeseriesForAssetLoader.load(asset.id),

    parentAsset: (asset: Asset, args: any, context: any) =>
      asset.parentId
        ? context.dataloaders.assetLoader.load(asset.parentId)
        : null,

    childrenAssets: (asset: Asset, args: any, { dataloaders }: any) =>
      dataloaders.assetsChildrenloader.load(asset.id),

    events: (asset: Asset, args: any, context: any) =>
      context.dataloaders.eventsForAssetLoader.load(asset.id),
  },

  Event: {
    actionLevel: (event: CogniteEvent) => event.metadata?.actionLevel,
    startTime: (event: CogniteEvent) =>
      event.startTime ? new Date(event.startTime).toISOString() : null,
    endTime: (event: CogniteEvent) =>
      event.endTime ? new Date(event.endTime).toISOString() : null,
  },
};

function batchAssets(assetIds: number[]) {
  console.log("Batch assets fetch", assetIds);
  return cogniteClient.assets.retrieve(assetIds.map((id) => ({ id: id })));
}

function batchAssetTimeseries(assetIds: number[]): Promise<Timeseries[][]> {
  console.log("Batch asset timeseries fetch", assetIds);
  const idsChunks: number[][] = chunk(assetIds, 100); // CDF - limitation - up to 100 tds per request

  return Promise.all(
    idsChunks.map((idsChunk) =>
      cogniteClient.timeseries
        .list({ filter: { assetIds: idsChunk } })
        .then((res) => res.items)
    )
  )
    .then((tsChunks: Timeseries[][]) => flatten(tsChunks))
    .then((timeseries: Timeseries[]) =>
      assetIds.map((key) => timeseries.filter((ts) => ts.assetId === key))
    );
}

function batchAssetEvents(assetIds: number[]): Promise<CogniteEvent[][]> {
  console.log("Batch asset events fetch", assetIds);

  return cogniteClient.events
    .list({ filter: { assetIds: assetIds } })
    .then((res) =>
      assetIds.map((key) =>
        res.items.filter((event) => event.assetIds?.some((id) => id === key))
      )
    );
}

function batchAssetChildren(assetIds: number[]): Promise<CogniteEvent[][]> {
  console.log("Batch asset children fetch", assetIds);

  return cogniteClient.assets
    .list({ filter: { parentIds: assetIds } })
    .then((res) =>
      assetIds.map((key) => res.items.filter((asset) => asset.parentId === key))
    );
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: {
    dataloaders: {
      // @ts-ignore
      assetLoader: new DataLoader(batchAssets),
      // @ts-ignore
      timeseriesForAssetLoader: new DataLoader(batchAssetTimeseries),
      // @ts-ignore
      eventsForAssetLoader: new DataLoader(batchAssetEvents),
      // @ts-ignore
      assetsChildrenloader: new DataLoader(batchAssetChildren),
    },
  },
});

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
