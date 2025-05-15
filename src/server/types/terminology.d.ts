// types/terminology.d.ts

import { Document } from "mongoose";
import { JskosConceptSchemeDocument } from "./jskos";

export type TerminologyDocument = Document & JskosConceptSchemeDocument;
