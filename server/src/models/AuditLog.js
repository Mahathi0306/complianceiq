import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema(
  {
    actor: { type: String, required: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true },
    entityId: { type: String, required: true },
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    at: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

auditSchema.index({ entity: 1, entityId: 1, at: -1 });

const blocked = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'replaceOne',
  'deleteOne',
  'deleteMany',
];

for (const op of blocked) {
  auditSchema.pre(op, function () {
    throw new Error('Audit records are append-only');
  });
}

auditSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('Audit records are append-only'));
  next();
});

export const AuditLog = mongoose.model('AuditLog', auditSchema);
