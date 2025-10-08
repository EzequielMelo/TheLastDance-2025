-- Crear tabla de chats
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  client_id UUID REFERENCES users(id) ON DELETE CASCADE,
  waiter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'waiter')),
  message_text TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'notification')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_chats_table_id ON chats(table_id);
CREATE INDEX IF NOT EXISTS idx_chats_client_id ON chats(client_id);
CREATE INDEX IF NOT EXISTS idx_chats_waiter_id ON chats(waiter_id);
CREATE INDEX IF NOT EXISTS idx_chats_is_active ON chats(is_active);

-- Crear índice único condicional para garantizar un solo chat activo por mesa
CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_unique_table_active 
ON chats(table_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at en chats
DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;
CREATE TRIGGER update_chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE chats IS 'Chats entre clientes y meseros por mesa';
COMMENT ON TABLE messages IS 'Mensajes del chat entre cliente y mesero';

COMMENT ON COLUMN chats.table_id IS 'ID de la mesa donde ocurre el chat';
COMMENT ON COLUMN chats.client_id IS 'ID del cliente en el chat';
COMMENT ON COLUMN chats.waiter_id IS 'ID del mesero asignado a la mesa';
COMMENT ON COLUMN chats.is_active IS 'Si el chat está activo (cliente aún en mesa)';

COMMENT ON COLUMN messages.sender_type IS 'Tipo de usuario que envía: client o waiter';
COMMENT ON COLUMN messages.message_type IS 'Tipo de mensaje: text, image, notification';
COMMENT ON COLUMN messages.is_read IS 'Si el mensaje fue leído por el destinatario';