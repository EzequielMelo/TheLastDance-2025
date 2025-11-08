import AsyncStorage from "@react-native-async-storage/async-storage";

const DISCOUNT_KEY = "@dm_discount_v1";

export type Discount = {
  amount: number;
  received: boolean;
};

export async function getDiscount(): Promise<Discount | null> {
  try {
    const raw = await AsyncStorage.getItem(DISCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Discount>;
    const discount: Discount = {
      amount: typeof parsed.amount === "number" ? parsed.amount : 0,
      received: !!parsed.received,
    };
    return discount;
  } catch (e) {
    console.warn("[discount] getDiscount", e);
    return null;
  }
}

export async function setDiscount(
  amount: number,
  received: boolean,
): Promise<boolean> {
  try {
    await AsyncStorage.setItem(
      DISCOUNT_KEY,
      JSON.stringify({ amount, received }),
    );
    return true;
  } catch (e) {
    console.warn("[discount] setDiscount", e);
    return false;
  }
}

export async function clearDiscount(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(DISCOUNT_KEY);
    return true;
  } catch (e) {
    console.warn("[discount] clearDiscount", e);
    return false;
  }
}

export async function awardIfFirstWin(
  isWin: boolean,
  amountIfWin: number,
  userProfileCode?: string,
): Promise<{ awarded: boolean; discount: Discount | null }> {
  try {
    // Los usuarios anónimos no reciben descuentos
    if (userProfileCode === "cliente_anonimo") {
      return { awarded: false, discount: null };
    }
    
    const current = await getDiscount();
    
    if (isWin) {
      // Si no hay descuento actual, otorgar el nuevo
      if (!current || !current.received) {
        const newDiscount: Discount = { amount: amountIfWin, received: true };
        await AsyncStorage.setItem(DISCOUNT_KEY, JSON.stringify(newDiscount));
        return { awarded: true, discount: newDiscount };
      }
      
      // Si ya hay un descuento, pero el nuevo es mayor, actualizar
      if (amountIfWin > current.amount) {
        const newDiscount: Discount = { amount: amountIfWin, received: true };
        await AsyncStorage.setItem(DISCOUNT_KEY, JSON.stringify(newDiscount));
        return { awarded: true, discount: newDiscount };
      }
      
      // Si el descuento actual es igual o mayor, no otorgar nuevo descuento
      return { awarded: false, discount: current };
    }
    
    return { awarded: false, discount: current ?? null };
  } catch (e) {
    console.warn("[discount] awardIfFirstWin", e);
    return { awarded: false, discount: null };
  }
}
