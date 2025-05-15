import mongoose, { Document, Schema, Model } from "mongoose";

export interface MetaDocument extends Document {
  _default: true;
  version?: string;
}

const metaSchema = new Schema<MetaDocument>(
  {
    _default: {
      type: Boolean,
      default: true,
      required: true,
      unique: true,
      immutable: true,
    },
    version: {
      type: String,
    },
  },
  {
    versionKey: false,
    strict: false,
    collection: "meta",
    autoIndex: false,
  },
);

export const Meta: Model<MetaDocument> = mongoose.model("meta", metaSchema);
