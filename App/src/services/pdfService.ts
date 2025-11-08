import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

interface OrderItem {
  name: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderData {
  clientName: string;
  tableNumber: string;
  items: OrderItem[];
  subtotal: number;
  tipAmount: number;
  gameDiscountAmount: number;
  gameDiscountPercentage: number;
  totalAmount: number;
  satisfactionLevel: string;
  orderDate: string;
  orderTime: string;
  invoiceNumber: string;
}

export class PDFService {
  static async generateInvoicePDF(orderData: OrderData): Promise<void> {
    try {
      const htmlContent = this.createInvoiceHTML(orderData);
      
      // Generar PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Compartir el PDF directamente desde el URI temporal
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartir Factura',
        });
      } else {
        console.log('Sharing no está disponible en este dispositivo');
      }

    } catch (error) {
      console.error('Error generando PDF:', error);
      throw new Error('No se pudo generar la factura PDF');
    }
  }

  private static createInvoiceHTML(data: OrderData): string {
    const itemsHTML = data.items.map((item, index) => `
      <tr>
        <td class="text-left">${index + 1}</td>
        <td class="text-left">${item.name}</td>
        <td class="text-right">${item.quantity.toFixed(0)}</td>
        <td class="text-center">un.</td>
        <td class="text-right">$${item.unitPrice.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
        <td class="text-center">0,00</td>
        <td class="text-right">$${(item.totalPrice / 1.21).toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
        <td class="text-right">21,00</td>
        <td class="text-right">$${item.totalPrice.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
      </tr>
    `).join('');

    // Calcular totales con IVA incluido
    const totalConIVA = data.totalAmount;
    const netoGravado = totalConIVA / 1.21;
    const ivaAmount = totalConIVA - netoGravado;
    const finalTotal = totalConIVA - data.gameDiscountAmount + data.tipAmount;

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Factura - The Last Dance</title>
        <style>
          * {
            box-sizing: border-box;
            font-family: Arial, sans-serif;
          }

          body {
            width: 21cm;
            min-height: 27cm;
            max-height: 29.7cm;
            font-size: 13px;
            margin: 0;
            padding: 0;
            background-color: #fff;
          }

          .wrapper {
            border: 1.5px solid #333;
            padding: 5px;
          }

          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .italic { font-style: italic; }
          .inline-block { display: inline-block; }
          .flex { display: flex; flex-wrap: wrap; }
          .no-margin { margin: 0; }
          .relative { position: relative; }

          .floating-mid {
            position: absolute;
            left: 50%;
            top: 1px;
            transform: translateX(-50%);
            width: 75px;
            background: #fff;
            z-index: 10;
          }

          .space-around { justify-content: space-around; }
          .space-between { justify-content: space-between; }
          .w50 { width: 50%; }

          th {
            border: 1px solid #000;
            background: #ccc;
            padding: 5px;
            font-weight: bold;
          }

          td {
            padding: 5px;
            font-size: 11px;
            border: 1px solid #000;
          }

          table {
            border-collapse: collapse;
            width: 100%;
          }

          .text-20 { font-size: 20px; }

          .items-table th:nth-child(1) { width: 8%; }
          .items-table th:nth-child(2) { width: 25%; }
          .items-table th:nth-child(3) { width: 8%; }
          .items-table th:nth-child(4) { width: 8%; }
          .items-table th:nth-child(5) { width: 12%; }
          .items-table th:nth-child(6) { width: 8%; }
          .items-table th:nth-child(7) { width: 12%; }
          .items-table th:nth-child(8) { width: 9%; }
          .items-table th:nth-child(9) { width: 10%; }

          .items-table td:nth-child(2) { 
            word-wrap: break-word; 
            white-space: normal; 
          }

          .discount-row {
            background-color: #f5f5f5;
          }

          .tip-row {
            background-color: #f5f5f5;
          }



          @media print {
            body { background-color: white; }
            .wrapper { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="wrapper text-center bold text-20" style="width:100%; border-bottom: 0;">
          ORIGINAL
        </div>

        <div class="flex relative">
          <div class="wrapper inline-block w50" style="border-right: 0">
            <h3 class="text-center" style="font-size:24px;margin-bottom: 3px;width: 100%;">THE LAST DANCE</h3>
            <p style="font-size: 13px;line-height: 1.5;margin-bottom: 0;align-self: flex-end;">
              <b>Razón Social:</b> The Last Dance S.R.L.
              <br><b>Domicilio Comercial:</b> Av. Principal 123 - CABA
              <br><b>Condición frente al IVA: Responsable Inscripto</b>
            </p>
          </div>
          <div class="wrapper inline-block w50">
            <h3 class="text-center" style="font-size:24px;margin-bottom: 3px;">FACTURA</h3>
            <p style="font-size: 13px;line-height: 1.5;margin-bottom: 0;">
              <b>Punto de Venta: 00001 Comp. Nro: ${data.invoiceNumber.replace('INV-', '').padStart(8, '0')}</b>
              <br><b>Fecha de Emisión: ${data.orderDate}</b>
              <br><b>CUIT:</b> 30-12345678-9
              <br><b>Ingresos Brutos:</b> CM
              <br><b>Fecha de Inicio de Actividades:</b> 01/01/2024
            </p>
          </div>
          <div class="wrapper floating-mid">
            <h3 class="no-margin text-center" style="font-size: 36px;">C</h3>
            <h5 class="no-margin text-center">COD. 011</h5>
          </div>
        </div>

        <div class="wrapper flex space-around" style="margin-top: 1px;">
          <span><b>Período Facturado Desde:</b> ${data.orderDate}</span>
          <span><b>Hasta:</b> ${data.orderDate}</span>
          <span><b>Fecha de Vto. para el pago:</b> ${data.orderDate}</span>
        </div>

        <div class="wrapper" style="margin-top: 2px;font-size: 12px;">
          <div class="flex" style="margin-bottom: 15px;">
            <span style="width:30%"><b>CUIT:</b> 00-00000000-0</span>
            <span><b>Apellido y Nombre / Razón Social:</b> ${data.clientName}</span>
          </div>
          <div class="flex" style="flex-wrap: nowrap;margin-bottom: 5px;">
            <span style="width:70%"><b>Condición frente al IVA:</b> Consumidor Final</span>
            <span><b>Mesa:</b> ${data.tableNumber}</span>
          </div>
          <div class="flex">
            <span><b>Condición de venta:</b> Contado</span>
          </div>
        </div>

        <table class="items-table" style="margin-top: 5px;">
          <thead>
            <th class="text-left">Código</th>
            <th class="text-left">Producto / Servicio</th>
            <th>Cantidad</th>
            <th>U. Medida</th>
            <th>Precio Unit.</th>
            <th>% Bonif</th>
            <th>Subtotal</th>
            <th>Alícuota IVA</th>
            <th>Subtotal c/IVA</th>
          </thead>
          <tbody>
            ${itemsHTML}
            ${data.gameDiscountAmount > 0 ? `
              <tr class="discount-row">
                <td class="text-left">DESC1</td>
                <td class="text-left">Descuento por juegos (${data.gameDiscountPercentage}%)</td>
                <td class="text-right">1,00</td>
                <td class="text-center">descuentos</td>
                <td class="text-right">-$${data.gameDiscountAmount.toFixed(2)}</td>
                <td class="text-center">0,00</td>
                <td class="text-right">-$${data.gameDiscountAmount.toFixed(2)}</td>
                <td class="text-right">0,00</td>
                <td class="text-right">-$${data.gameDiscountAmount.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${data.tipAmount > 0 ? `
              <tr class="tip-row">
                <td class="text-left">TIP</td>
                <td class="text-left">Propina</td>
                <td class="text-right">1,00</td>
                <td class="text-center">servicios</td>
                <td class="text-right">$${data.tipAmount.toFixed(2)}</td>
                <td class="text-center">0,00</td>
                <td class="text-right">$${data.tipAmount.toFixed(2)}</td>
                <td class="text-right">0,00</td>
                <td class="text-right">$${data.tipAmount.toFixed(2)}</td>
              </tr>
            ` : ''}
          </tbody>
        </table>

        <div class="footer" style="margin-top: 50px;">
          <div class="flex wrapper space-between" style="justify-content: flex-end;">
            <div style="width:40%;margin-top: 40px;" class="flex wrapper">
              <span class="text-right" style="width:60%"><b>Importe Neto Gravado: $</b></span>
              <span class="text-right" style="width:40%"><b>${netoGravado.toLocaleString('es-AR', {minimumFractionDigits: 2})}</b></span>
              
              <span class="text-right" style="width:60%"><b>IVA 21%: $</b></span>
              <span class="text-right" style="width:40%"><b>${ivaAmount.toLocaleString('es-AR', {minimumFractionDigits: 2})}</b></span>
              
              <span class="text-right" style="width:60%"><b>Importe Total: $</b></span>
              <span class="text-right" style="width:40%"><b>${finalTotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}</b></span>
            </div>
          </div>
          
          <div class="flex relative" style="margin-top: 20px;">
            <div class="qr-container" style="padding: 0 20px 20px 20px;width: 20%;">
              <!-- QR Code podría ir aquí -->
            </div>
            <div style="padding-left: 10px;width: 45%;">
              <h4 class="italic bold">Comprobante Autorizado</h4>
              <p class="small italic bold" style="font-size: 9px;">Esta Administración Federal no se responsabiliza
                  por los datos ingresados en el detalle de la operación</p>
              <p style="font-size: 10px;"><b>Generado:</b> ${data.orderDate} ${data.orderTime}</p>
              <p style="font-size: 10px;"><b>The Last Dance Restaurant</b></p>
            </div>
            <div class="flex" style="align-self: flex-start;width: 35%;">
              <span class="text-right" style="width:50%"><b>CAE N°:</b></span>
              <span class="text-left" style="padding-left: 10px;">12345678901234</span>
              
              <span class="text-right" style="width:50%"><b>Fecha de Vto. de CAE:</b></span>
              <span class="text-left" style="padding-left: 10px;">${data.orderDate}</span>
            </div>
            <span class="floating-mid bold">Pág 1/1</span>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}