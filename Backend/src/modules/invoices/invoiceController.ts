import { Request, Response } from 'express';
import { InvoiceService } from './invoiceService';
import path from 'path';
import fs from 'fs';

const invoiceController = {
  async downloadInvoice(req: Request, res: Response) {
    try {
      const { fileName } = req.params;
      
      if (!fileName) {
        return res.status(400).json({ error: 'Nombre de archivo requerido' });
      }

      // Validar que el archivo existe
      const invoicesDir = path.join(process.cwd(), 'invoices');
      const filePath = path.join(invoicesDir, fileName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Factura no encontrada' });
      }

      // Validar que el archivo está dentro del directorio de facturas (seguridad)
      const normalizedPath = path.normalize(filePath);
      const normalizedDir = path.normalize(invoicesDir);
      
      if (!normalizedPath.startsWith(normalizedDir)) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      // Enviar el archivo
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      return;

    } catch (error) {
      console.error('Error descargando factura:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }
  },

  async generateInvoice(req: Request, res: Response) {
    try {
      const { tableId } = req.params;
      
      if (!tableId) {
        return res.status(400).json({ error: 'ID de mesa requerido' });
      }

      // Obtener el cliente de la mesa
      const { supabaseAdmin } = await import('../../config/supabase');
      const { data: tableData, error: tableError } = await supabaseAdmin
        .from('tables')
        .select('id_client')
        .eq('id', tableId)
        .single();

      if (tableError || !tableData?.id_client) {
        return res.status(404).json({ error: 'Mesa o cliente no encontrado' });
      }

      // Generar la factura
      const result = await InvoiceService.generateInvoiceHTML(
        tableId,
        tableData.id_client
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Factura generada exitosamente',
          filePath: result.filePath,
          fileName: result.filePath ? path.basename(result.filePath) : undefined
        });
        return;
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Error generando factura'
        });
        return;
      }

    } catch (error) {
      console.error('Error generando factura:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }
  }
};

export default invoiceController;
export { invoiceController };