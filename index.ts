import { ApolloServer, gql } from "apollo-server";
import { Asset, CogniteEvent } from "@cognite/sdk";
import { cogniteClient } from "./cognite-client";

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

interface MyAsset {
  id: number;
  name: string;
}

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
    timeseries: (asset: Asset) =>
      cogniteClient.timeseries
        .list({ filter: { assetIds: [asset.id] } })
        .then((res) => res.items),

    parentAsset: (asset: Asset) =>
      asset.parentId
        ? cogniteClient.assets
            .retrieve([{ id: asset.parentId }])
            .then((res) => (res.length ? res[0] : null))
        : null,

    childrenAssets: (asset: Asset) =>
      cogniteClient.assets
        .list({ filter: { parentIds: [asset.id] } })
        .then((res) => res.items),

    events: (asset: Asset) =>
      cogniteClient.events
        .list({ filter: { assetIds: [asset.id] } })
        .then((res) => res.items),
  },

  Event: {
    actionLevel: (event: CogniteEvent) => event.metadata?.actionLevel,
    startTime: (event: CogniteEvent) => event.startTime ? new Date(event.startTime).toISOString() : null,
    endTime: (event: CogniteEvent) => event.endTime ? new Date(event.endTime).toISOString() : null,
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
