-- Remove the email outbox. The application sends no client email; webhooks go out on
-- the request that causes them (WebhookDelivery stays as the retry record).
DROP TABLE IF EXISTS "CommunicationDelivery";
DROP TYPE IF EXISTS "CommunicationDeliveryChannelType";
DROP TYPE IF EXISTS "CommunicationDeliveryStatusType";
