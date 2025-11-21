import fs from "fs";
import path from "path";
import { supabaseAdmin } from "../../config/supabase";

interface InvoiceData {
  tableNumber: string;
  clientName: string;
  waiterName: string;
  orders: Array<{
    id: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      total: number;
    }>;
    total_amount: number;
    created_at: string;
  }>;
  discounts: Array<{
    game: string;
    discount: number;
    amount: number;
  }>;
  tip: number;
  totalAmount: number;
  paymentMethod?: string;
  satisfactionRating?: number;
  invoiceNumber: string;
  invoiceDate: string;
}

export class InvoiceService {
  // Para clientes REGISTRADOS: Solo generar HTML sin guardar archivo
  static async generateInvoiceHTMLOnly(
    tableId: string,
    clientId: string,
  ): Promise<{ success: boolean; htmlContent?: string; error?: string }> {
    try {
      // Obtener datos de la factura
      const invoiceData = await this.getInvoiceData(tableId, clientId);

      if (!invoiceData) {
        return {
          success: false,
          error: "No se encontraron datos para la factura",
        };
      }

      // Generar solo el HTML sin guardarlo
      const htmlContent = this.createHTMLInvoice(invoiceData);
      return { success: true, htmlContent };
    } catch (error) {
      console.error("Error generando factura HTML:", error);
      return { success: false, error: "Error interno generando factura" };
    }
  }

  // Para clientes ANÓNIMOS: Generar HTML Y guardar archivo para descarga
  static async generateInvoiceWithFile(
    tableId: string,
    clientId: string,
  ): Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    htmlContent?: string;
    error?: string;
  }> {
    try {
      // Obtener datos de la factura
      const invoiceData = await this.getInvoiceData(tableId, clientId);

      if (!invoiceData) {
        return {
          success: false,
          error: "No se encontraron datos para la factura",
        };
      }

      // Generar el HTML
      const htmlContent = this.createHTMLInvoice(invoiceData);

      // Guardar el archivo HTML para usuarios anónimos
      const filePath = await this.saveHTMLFile(invoiceData, htmlContent);
      const fileName = path.basename(filePath);
      return { success: true, filePath, fileName, htmlContent };
    } catch (error) {
      console.error("Error generando factura con archivo:", error);
      return { success: false, error: "Error interno generando factura" };
    }
  }

  // MÉTODO LEGACY: Mantener por compatibilidad (usar generateInvoiceWithFile para nuevos casos)
  static async generateInvoiceHTML(
    tableId: string,
    clientId: string,
  ): Promise<{
    success: boolean;
    filePath?: string;
    htmlContent?: string;
    error?: string;
  }> {
    return this.generateInvoiceWithFile(tableId, clientId);
  }

  // ============= MÉTODOS PARA DELIVERY =============

  // Para clientes REGISTRADOS de delivery: Solo generar HTML
  static async generateDeliveryInvoiceHTMLOnly(
    deliveryId: string,
    clientId: string,
  ): Promise<{ success: boolean; htmlContent?: string; error?: string }> {
    try {
      // Obtener datos de la factura desde delivery
      const invoiceData = await this.getDeliveryInvoiceData(deliveryId, clientId);

      if (!invoiceData) {
        return {
          success: false,
          error: "No se encontraron datos para la factura de delivery",
        };
      }

      // Generar solo el HTML sin guardarlo
      const htmlContent = this.createHTMLInvoice(invoiceData);
      return { success: true, htmlContent };
    } catch (error) {
      console.error("Error generando factura HTML de delivery:", error);
      return { success: false, error: "Error interno generando factura" };
    }
  }

  // Para clientes ANÓNIMOS de delivery: Generar HTML Y guardar archivo
  static async generateDeliveryInvoiceWithFile(
    deliveryId: string,
    clientId: string,
  ): Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    htmlContent?: string;
    error?: string;
  }> {
    try {
      // Obtener datos de la factura desde delivery
      const invoiceData = await this.getDeliveryInvoiceData(deliveryId, clientId);

      if (!invoiceData) {
        return {
          success: false,
          error: "No se encontraron datos para la factura de delivery",
        };
      }

      // Generar el HTML
      const htmlContent = this.createHTMLInvoice(invoiceData);

      // Guardar el archivo HTML para usuarios anónimos
      const filePath = await this.saveHTMLFile(invoiceData, htmlContent);
      const fileName = path.basename(filePath);
      return { success: true, filePath, fileName, htmlContent };
    } catch (error) {
      console.error("Error generando factura con archivo de delivery:", error);
      return { success: false, error: "Error interno generando factura" };
    }
  }

  private static async getInvoiceData(
    tableId: string,
    clientId: string,
  ): Promise<InvoiceData | null> {
    try {
      // Obtener datos de la mesa
      const { data: tableData, error: tableError } = await supabaseAdmin
        .from("tables")
        .select("number, id_waiter")
        .eq("id", tableId)
        .single();

      if (tableError || !tableData) {
        console.error("Error obteniendo datos de mesa:", tableError);
        throw new Error("Error obteniendo datos de mesa");
      }

      // Obtener datos del mozo usando el id_waiter de la mesa
      const { data: waiterData, error: waiterError } = await supabaseAdmin
        .from("users")
        .select("first_name, last_name")
        .eq("id", tableData.id_waiter)
        .single();

      if (waiterError || !waiterData) {
        console.error("Error obteniendo datos del mozo:", waiterError);
        throw new Error("Error obteniendo datos del mozo");
      }

      const { data: clientData, error: clientError } = await supabaseAdmin
        .from("users")
        .select("first_name, last_name")
        .eq("id", clientId)
        .single();

      if (clientError || !clientData) {
        console.error("Error obteniendo datos del cliente:", clientError);
        throw new Error("Error obteniendo datos del cliente");
      }

      // Usar exactamente la misma consulta que funciona en billController.ts
      const { data: orders, error: ordersError } = await supabaseAdmin
        .from("orders")
        .select(
          `
          id,
          total_amount,
          created_at,
          order_items!inner (
            id,
            quantity,
            unit_price,
            subtotal,
            status,
            menu_items (
              id,
              name,
              category
            )
          )
        `,
        )
        .eq("table_id", tableId)
        .eq("user_id", clientId)
        .eq("is_paid", false) // CORREGIDO: Consultar órdenes NO pagadas
        .eq("order_items.status", "delivered")
        .order("created_at", { ascending: true });

      if (ordersError) {
        console.error("Error obteniendo órdenes:", ordersError);
        throw new Error("Error obteniendo órdenes");
      }

      if (!orders || orders.length === 0) {
        console.error(
          "No se encontraron órdenes pendientes de pago para la mesa",
        );
        throw new Error("No se encontraron órdenes pendientes de pago");
      }

      // Formatear los datos
      const clientName =
        `${clientData.first_name} ${clientData.last_name}`.trim();

      // Formatear el nombre del mozo (ya tenemos waiterData de la consulta anterior)
      const waiterName = waiterData
        ? `${waiterData.first_name} ${waiterData.last_name}`.trim()
        : "N/A";

      // Procesar los datos exactamente como lo hace billController.ts
      let billItems: any[] = [];
      let subtotal = 0;

      orders?.forEach(order => {
        order.order_items?.forEach((item: any) => {
          const menuItem = Array.isArray(item.menu_items)
            ? item.menu_items[0]
            : item.menu_items;
          billItems.push({
            id: item.id,
            name: menuItem?.name || "Item desconocido",
            category: menuItem?.category || "Sin categoría",
            quantity: item.quantity,
            price: item.unit_price,
            total: item.subtotal,
          });
          subtotal += item.subtotal;
        });
      });

      const formattedOrders = [
        {
          id: "consolidated",
          items: billItems,
          total_amount: subtotal,
          created_at: new Date().toISOString(),
        },
      ];

      const totalAmount = subtotal;

      // Generar número y fecha de factura
      const invoiceNumber = `INV-${Date.now()}`;
      const invoiceDate = new Date().toLocaleDateString("es-AR");

      return {
        tableNumber: tableData.number.toString(),
        clientName,
        waiterName,
        orders: formattedOrders,
        discounts: [], // TODO: Obtener descuentos de juegos
        tip: 0, // TODO: Obtener propina
        totalAmount,
        invoiceNumber,
        invoiceDate,
      };
    } catch (error) {
      console.error("Error obteniendo datos de factura:", error);
      return null;
    }
  }

  private static createHTMLInvoice(data: InvoiceData): string {
    const currentDate = new Date().toLocaleDateString("es-AR");
    const currentTime = new Date().toLocaleTimeString("es-AR");
    const invoiceNumber = data.invoiceNumber
      .replace("INV-", "")
      .padStart(8, "0");

    // Calcular correctamente con IVA ya incluido en precios
    const totalConIVA = data.totalAmount; // Total que ya incluye IVA
    const netoGravado = totalConIVA / 1.21; // Base sin IVA (dividir por 1.21)

    const totalDiscount = data.discounts.reduce(
      (sum, discount) => sum + discount.amount,
      0,
    );
    const finalTotal = totalConIVA - totalDiscount + data.tip;

    // Crear items para la tabla - usar directamente los items de la primera orden consolidada
    const allItems = data.orders[0]?.items || [];

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Factura - The Last Dance</title>
    <style>
        * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }

        body {
            width: 21cm;
            min-height: 27cm;
            max-height: 29.7cm;
            font-size: 13px;
            margin: 0;
            padding: 0;
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
            left: 0;
            right: 0;
            margin-left: auto;
            margin-right: auto;
            width: 75px;
            position: absolute;
            top: 1px;
            background: #fff;
        }

        .space-around { justify-content: space-around; }
        .space-between { justify-content: space-between; }
        .w50 { width: 50%; }

        th {
            border: 1px solid #000;
            background: #ccc;
            padding: 3px;
            font-size: 10px;
            white-space: nowrap;
        }

        td {
            padding: 3px;
            font-size: 10px;
            border: 1px solid #000;
            white-space: nowrap;
        }

        table {
            border-collapse: collapse;
            width: 100%;
            table-layout: fixed;
        }

        /* Ancho específico para las columnas de la tabla principal */
        .items-table th:nth-child(1) { width: 8%; }  /* Código */
        .items-table th:nth-child(2) { width: 25%; } /* Producto */
        .items-table th:nth-child(3) { width: 8%; }  /* Cantidad */
        .items-table th:nth-child(4) { width: 8%; }  /* U. Medida */
        .items-table th:nth-child(5) { width: 12%; } /* Precio Unit */
        .items-table th:nth-child(6) { width: 8%; }  /* % Bonif */
        .items-table th:nth-child(7) { width: 12%; } /* Subtotal */
        .items-table th:nth-child(8) { width: 9%; }  /* Alícuota IVA */
        .items-table th:nth-child(9) { width: 10%; } /* Subtotal c/IVA */

        .items-table td:nth-child(1) { width: 8%; }
        .items-table td:nth-child(2) { width: 25%; word-wrap: break-word; white-space: normal; }
        .items-table td:nth-child(3) { width: 8%; }
        .items-table td:nth-child(4) { width: 8%; }
        .items-table td:nth-child(5) { width: 12%; }
        .items-table td:nth-child(6) { width: 8%; }
        .items-table td:nth-child(7) { width: 12%; }
        .items-table td:nth-child(8) { width: 9%; }
        .items-table td:nth-child(9) { width: 10%; }

        .text-20 { font-size: 20px; }
        
        .discount-row {
            background-color: #e8f5e8;
            color: #2d5016;
        }

        .tip-row {
            background-color: #fff3cd;
            color: #856404;
        }
    </style>
</head>

<body>
    <div class="wrapper text-center bold text-20" style="width:100%;border-bottom: 0;">
        ORIGINAL
    </div>

    <div class="flex relative">
        <div class="wrapper w50 flex" style="border-right: 0">
            <h3 class="text-center" style="font-size:24px;margin-bottom: 3px;width: 100%;">THE LAST DANCE</h3>
            <p style="font-size: 13px;line-height: 1.5;margin-bottom: 0;align-self: flex-end;">
                <b>Razón Social:</b> The Last Dance S.R.L.
                <br><b>Domicilio Comercial:</b> Av. Principal 123 - CABA
                <br><b>Condición frente al IVA:</b> Responsable Inscripto
            </p>
        </div>
        <div class="wrapper flex w50">
            <h3 class="text-center" style="font-size:24px;margin-bottom: 3px;">FACTURA</h3>
            <p style="font-size: 13px;line-height: 1.5;margin-bottom: 0;">
                <b>Punto de Venta: 00001 Comp. Nro: ${invoiceNumber}</b>
                <br><b>Fecha de Emisión:</b> ${currentDate}
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
        <span><b>Período Facturado Desde:</b> ${currentDate}</span>
        <span><b>Hasta:</b> ${currentDate}</span>
        <span><b>Fecha de Vto. para el pago:</b> ${currentDate}</span>
    </div>

    <div class="wrapper" style="margin-top: 2px;font-size: 12px;">
        <div class="flex" style="margin-bottom: 15px;">
            <span style="width:30%"><b>CUIT:</b> 00-00000000-0</span>
            <span><b>Apellido y Nombre / Razón Social:</b> ${data.clientName}</span>
        </div>
        <div class="flex" style="flex-wrap: nowrap;margin-bottom: 5px;">
            <span style="width:70%"><b>Condición frente al IVA:</b> Consumidor Final</span>
            <span><b>Mesa:</b> ${data.tableNumber} | <b>Mozo:</b> ${data.waiterName}</span>
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
            ${(() => {
              const tableRows = allItems
                .map((item, index) => {
                  return `
                <tr>
                    <td class="text-left">${index + 1}</td>
                    <td class="text-left">${item.name}</td>
                    <td class="text-right">${item.quantity.toFixed(0)}</td>
                    <td class="text-center">un.</td>
                    <td class="text-right">$${item.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                    <td class="text-center">0,00</td>
                    <td class="text-right">$${(item.total / 1.21).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                    <td class="text-right">21,00</td>
                    <td class="text-right">$${item.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                </tr>`;
                })
                .join("");
              return tableRows;
            })()}
            ${data.discounts
              .map(
                (discount, index) => `
                <tr class="discount-row">
                    <td class="text-left">DESC${index + 1}</td>
                    <td class="text-left">Descuento ${discount.game}</td>
                    <td class="text-right">1,00</td>
                    <td class="text-center">descuentos</td>
                    <td class="text-right">-${discount.amount.toFixed(2)}</td>
                    <td class="text-center">0,00</td>
                    <td class="text-right">-${discount.amount.toFixed(2)}</td>
                    <td class="text-right">0,00</td>
                    <td class="text-right">-${discount.amount.toFixed(2)}</td>
                </tr>
            `,
              )
              .join("")}
            ${
              data.tip > 0
                ? `
                <tr class="tip-row">
                    <td class="text-left">TIP</td>
                    <td class="text-left">Propina</td>
                    <td class="text-right">1,00</td>
                    <td class="text-center">servicios</td>
                    <td class="text-right">${data.tip.toFixed(2)}</td>
                    <td class="text-center">0,00</td>
                    <td class="text-right">${data.tip.toFixed(2)}</td>
                    <td class="text-right">0,00</td>
                    <td class="text-right">${data.tip.toFixed(2)}</td>
                </tr>
            `
                : ""
            }
        </tbody>
    </table>

    <div class="footer" style="margin-top: 50px;">
        <div class="flex wrapper space-between" style="justify-content: flex-end;">
            <div style="width:40%;margin-top: 40px;">
                <div class="wrapper" style="padding: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span><b>Importe Neto Gravado:</b></span>
                        <span><b>$${netoGravado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</b></span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span><b>IVA 21%:</b></span>
                        <span><b>$${(totalConIVA - netoGravado).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</b></span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px solid #000; padding-top: 5px;">
                        <span><b>IMPORTE TOTAL:</b></span>
                        <span><b>$${finalTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</b></span>
                    </div>
                </div>
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
                <p style="font-size: 10px;"><b>Generado:</b> ${currentDate} ${currentTime}</p>
                <p style="font-size: 10px;"><b>The Last Dance Restaurant</b></p>
            </div>
            <div class="flex" style="align-self: flex-start;width: 35%;">
                <span class="text-right" style="width:50%"><b>CAE N°:</b></span>
                <span class="text-left" style="padding-left: 10px;">12345678901234</span>
                
                <span class="text-right" style="width:50%"><b>Fecha de Vto. de CAE:</b></span>
                <span class="text-left" style="padding-left: 10px;">${currentDate}</span>
            </div>
            <span class="floating-mid bold">Pág 1/1</span>
        </div>
    </div>
</body>
</html>`;
  }

  private static async getDeliveryInvoiceData(
    deliveryId: string,
    clientId: string,
  ): Promise<InvoiceData | null> {
    try {
      console.log(`📋 Obteniendo datos de factura para delivery: ${deliveryId}, cliente: ${clientId}`);
      
      // Obtener datos del delivery con orden y repartidor
      const { data: deliveryData, error: deliveryError } = await supabaseAdmin
        .from("deliveries")
        .select(`
          id,
          delivery_address,
          driver_id,
          delivery_order_id,
          tip_amount,
          delivery_order:delivery_orders (
            id,
            total_amount,
            delivery_order_items (
              id,
              quantity,
              unit_price,
              subtotal,
              menu_item:menu_items (
                id,
                name,
                category
              )
            )
          )
        `)
        .eq("id", deliveryId)
        .eq("user_id", clientId)
        .single();

      if (deliveryError || !deliveryData) {
        console.error(`❌ Error obteniendo datos de delivery ${deliveryId}:`, deliveryError);
        console.error(`❌ Parámetros: deliveryId=${deliveryId}, clientId=${clientId}`);
        throw new Error(`Delivery no encontrado o no pertenece al cliente`);
      }
      
      console.log(`✅ Delivery obtenido correctamente, order_id: ${deliveryData.delivery_order_id}`);

      // Obtener datos del cliente
      const { data: clientData, error: clientError } = await supabaseAdmin
        .from("users")
        .select("first_name, last_name")
        .eq("id", clientId)
        .single();

      if (clientError || !clientData) {
        console.error("Error obteniendo datos del cliente:", clientError);
        throw new Error("Error obteniendo datos del cliente");
      }

      // Obtener datos del repartidor
      const { data: driverData, error: driverError } = await supabaseAdmin
        .from("users")
        .select("first_name, last_name")
        .eq("id", deliveryData.driver_id)
        .single();

      if (driverError || !driverData) {
        console.error("Error obteniendo datos del repartidor:", driverError);
        throw new Error("Error obteniendo datos del repartidor");
      }

      const clientName = `${clientData.first_name} ${clientData.last_name}`.trim();
      const driverName = `${driverData.first_name} ${driverData.last_name}`.trim();

      // Procesar items del delivery_order
      let billItems: any[] = [];
      let subtotal = 0;

      const deliveryOrder = deliveryData.delivery_order as any;
      if (deliveryOrder?.delivery_order_items) {
        deliveryOrder.delivery_order_items.forEach((item: any) => {
          const menuItem = item.menu_item;
          billItems.push({
            id: item.id,
            name: menuItem?.name || "Item desconocido",
            category: menuItem?.category || "Sin categoría",
            quantity: item.quantity,
            price: item.unit_price,
            total: item.subtotal,
          });
          subtotal += item.subtotal;
        });
      }

      const formattedOrders = [
        {
          id: "delivery-consolidated",
          items: billItems,
          total_amount: subtotal,
          created_at: new Date().toISOString(),
        },
      ];

      const tipAmount = deliveryData.tip_amount || 0;
      const totalAmount = subtotal;

      // Generar número y fecha de factura
      const invoiceNumber = `INV-DEL-${Date.now()}`;
      const invoiceDate = new Date().toLocaleDateString("es-AR");

      return {
        tableNumber: "DELIVERY", // Para delivery usamos "DELIVERY" en lugar de número de mesa
        clientName,
        waiterName: driverName, // El repartidor toma el rol del mozo
        orders: formattedOrders,
        discounts: [], // Por ahora sin descuentos en delivery
        tip: tipAmount,
        totalAmount,
        invoiceNumber,
        invoiceDate,
      };
    } catch (error) {
      console.error("Error obteniendo datos de factura de delivery:", error);
      return null;
    }
  }

  private static async saveHTMLFile(
    data: InvoiceData,
    htmlContent: string,
  ): Promise<string> {
    // Crear directorio de facturas si no existe
    const invoicesDir = path.join(process.cwd(), "invoices");
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    // Generar nombre único para el archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = data.tableNumber === "DELIVERY" 
      ? `factura-delivery-${timestamp}.html`
      : `factura-mesa-${data.tableNumber}-${timestamp}.html`;
    const filePath = path.join(invoicesDir, fileName);

    // Guardar el archivo
    fs.writeFileSync(filePath, htmlContent, "utf8");

    return filePath;
  }
}
