import { Request, Response } from "express";
import { supabaseAdmin } from "../../config/supabase";

export const getBillData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableId } = req.params;
    const userId = req.user?.appUserId;


    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Usuario no autenticado",
      });
      return;
    }


    // 1. Verificar que el usuario tiene acceso a esta mesa
    
    // Primero, verificar si la mesa existe
    const { data: tableExists, error: existsError } = await supabaseAdmin
      .from("tables")
      .select("id, number, id_client, is_occupied, table_status")
      .eq("id", tableId)
      .single();
    
    
    if (existsError || !tableExists) {
      console.log(`❌ Mesa no existe. Error:`, existsError);
      res.status(404).json({
        success: false,
        message: "Mesa no encontrada",
      });
      return;
    }
    
    // Ahora verificar si el usuario tiene acceso
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("id, number, id_client, is_occupied, table_status")
      .eq("id", tableId)
      .eq("id_client", userId)
      .eq("is_occupied", true)
      .single();


    if (tableError || !table) {
      res.status(404).json({
        success: false,
        message: "No tienes acceso a esta mesa",
      });
      return;
    }

    // 2. Verificar que el estado de la mesa sea 'bill_requested'
    if (table.table_status !== 'bill_requested') {
      res.status(400).json({
        success: false,
        message: "La cuenta no ha sido solicitada para esta mesa",
      });
      return;
    }

    // 3. Obtener todos los pedidos de la mesa
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(`
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
      `)
      .eq("table_id", tableId)
      .eq("user_id", userId)
      .eq("order_items.status", "delivered")
      .order("created_at", { ascending: true });

    if (ordersError) {
      res.status(500).json({
        success: false,
        message: "Error al obtener los pedidos",
      });
      return;
    }


    // 4. Procesar los datos para el formato del ticket
    let billItems: any[] = [];
    let subtotal = 0;

    orders?.forEach(order => {
      order.order_items?.forEach((item: any) => {
        const menuItem = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
        billItems.push({
          id: item.id,
          name: menuItem?.name || "Item desconocido",
          category: menuItem?.category || "Sin categoría",
          unitPrice: item.unit_price,
          quantity: item.quantity,
          totalPrice: item.subtotal,
        });
        subtotal += item.subtotal;
      });
    });

    // 5. Obtener descuentos por juegos (si los hay)
    // TODO: Implementar lógica de descuentos por juegos
    const gameDiscounts: any[] = [];
    const totalDiscounts = 0;

    // 6. Calcular total después de descuentos
    const finalTotal = subtotal - totalDiscounts;

    const billData = {
      tableNumber: table.number,
      tableId: table.id,
      items: billItems,
      subtotal,
      gameDiscounts,
      totalDiscounts,
      finalTotal,
      orderCount: orders?.length || 0,
      currency: "ARS", // o la moneda que uses
    };

    console.log(`✅ Datos de cuenta procesados: ${billItems.length} items, total: $${finalTotal}`);

    res.json({
      success: true,
      data: billData,
      message: "Datos de cuenta obtenidos exitosamente",
    });

  } catch (error) {
    console.error("Error en getBillData:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
};