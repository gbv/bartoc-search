import { connect } from "../mongo/mongo";
import { Terminology } from "../models/terminology";
import { faker } from "@faker-js/faker";
import config from "../conf/conf";
import { connection } from "mongoose";
import {
  conceptSchemeZodSchema,
  ConceptSchemeZodType,
} from "../validation/conceptScheme";

async function init() {
  await connect(true);
  await startLiveSeed(10000); // every 10 seconds
}

export async function startLiveSeed(interval = 5000) {
  let count = 1;
  config.warn?.("🚀 Starting live data insertion...");

  const insertFakeDoc = async () => {
    const person = () => ({
      prefLabel: {
        en: faker.person.fullName(),
      },
      uri: faker.internet.url(),
    });

    const publisher = () => ({
      prefLabel: {
        en: faker.company.name(),
      },
      uri: faker.internet.url(),
    });

    const rawDoc = new Terminology({
      "@context": "https://gbv.github.io/jskos/context.json",
      ACCESS: [{ uri: "http://bartoc.org/en/Access/Free" }],
      FORMAT: [{ uri: "http://bartoc.org/en/Format/Online" }],
      languages: ["en"],
      type: ["http://www.w3.org/2004/02/skos/core#ConceptScheme"],
      uri: faker.internet.url(),
      url: faker.internet.url(),
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      prefLabel: {
        en: faker.lorem.words(5),
      },
      definition: {
        en: [faker.lorem.sentences(2)],
      },
      contributor: [person()],
      creator: [person()],
      publisher: [publisher()],
      subject: [
        {
          uri: faker.internet.url(),
          notation: [faker.string.alpha({ length: 3 })],
          inScheme: [{ uri: faker.internet.url() }],
        },
      ],
    });

    const validation = conceptSchemeZodSchema.safeParse(rawDoc);

    if (!validation.success) {
      config.error?.("❌ Invalid fake terminology", validation.error.message);
      return;
    }

    const validDoc: ConceptSchemeZodType = validation.data;
    const mongoDoc = new Terminology(validDoc);
    await mongoDoc.save();

    config.warn?.(`📦 Inserted fake terminology #${count}`);
    count++;
  };

  // Initial insert
  if (connection.readyState === 1) {
    await insertFakeDoc();
  }

  // Insert at regular intervals
  setInterval(() => {
    insertFakeDoc().catch(console.error);
  }, interval);
}

init().catch(console.error); // every 10 seconds
