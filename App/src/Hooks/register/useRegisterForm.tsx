import { useState } from "react";
import * as ImagePicker from "expo-image-picker";

export type RNImage = { uri: string; name: string; type: string } | null;
export type RegisterMode = "anon" | "registered";
type Profile = "cliente_anonimo" | "cliente_registrado" | "empleado" | "supervisor";

export type FormDataType = {
  profile_code: Profile;
  position_code: "" | "bartender" | "cocinero" | "maitre" | "mozo";
  dni: string;
  cuil: string;
  email: string;
  password: string;
  file: RNImage;
  file_uri?: string;
  first_name: string;
  last_name: string;
  mode?: RegisterMode;
};

export const useRegisterForm = (
  onSubmit: (data: FormDataType) => Promise<void>,
  mode: RegisterMode = "registered",
  opts?: {
    profile?: Profile;
    requireFile?: boolean;
  }
) => {
  const profile_default: Profile =
    opts?.profile ??
    (mode === "anon" ? "cliente_anonimo" : "cliente_registrado");

  const [formData, setFormData] = useState<FormDataType>(() => ({
    mode,
    first_name: "", last_name: "",
    dni: "", cuil: "",
    email: "", password: "",
    profile_code: profile_default,
    position_code: profile_default === "empleado" ? "bartender" : "",
    file: null, file_uri: undefined,
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [focusedField, setFocusedField] = useState("");
  const [loading, setLoading] = useState(false);

  const requireFile = opts?.requireFile ?? false;

  const validateField = (field: string, value: any) => {
    if (field === "file") {
      return requireFile && !formData.file ? "Debes seleccionar una imagen" : "";
    }
    // reglas por perfil
    const p = formData.profile_code;
    const isClientAnon = p === "cliente_anonimo";
    const isClientReg  = p === "cliente_registrado";
    const isEmpleado   = p === "empleado";

    if (isClientAnon) {
      if (field === "first_name" || field === "last_name") {
        return !value || String(value).trim().length < 2 ? "Mínimo 2 caracteres" : "";
      }
      return "";
    }

    // cliente_registrado / empleado / supervisor
    switch (field) {
      case "first_name":
        return !value ? "Campo obligatorio" : "";
      case "last_name":
        return !value ? "Campo obligatorio" : "";
      case "dni":
        return !value ? "Campo obligatorio" : "";
      case "cuil":
        return !value ? "Campo obligatorio" : "";
      case "email":
        return !value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? "Email inválido" : "";
      case "password":
        return !value || String(value).length < 6 ? "Mínimo 6 caracteres" : "";
      case "position_code":
        return isEmpleado && !value ? "Elegí un puesto" : "";
      default:
        return "";
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, (formData as any)[field]);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      alert("Se necesita permiso para acceder a la galería");
      return;
    }
    const media = (ImagePicker as any).MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: media as any,
      allowsEditing: true,
      quality: 0.8,
      aspect: [1,1],
    });
    if (!result.canceled) {
      const a = result.assets[0];
      const uri = a.uri;
      const name = a.fileName || uri.split("/").pop() || `img_${Date.now()}.jpg`;
      const ext = (name.split(".").pop() || "jpg").toLowerCase();
      const type = a.mimeType || (ext === "png" ? "image/png" : "image/jpeg");
      const rnImage = { uri, name, type };
      setFormData(prev => ({ ...prev, file: rnImage, file_uri: uri }));
      setTouched(prev => ({ ...prev, file: true }));
      const error = validateField("file", rnImage);
      setErrors(prev => ({ ...prev, file: error }));
    }
  };

  const handleSubmit = async () => {
    // Para usuario anónimo, solo validamos nombre y apellido
    if (mode === "anon") {
      const keysToCheck = ["first_name", "last_name"];
      if (requireFile) keysToCheck.push("file");

      const allTouched = { ...touched };
      keysToCheck.forEach(k => (allTouched[k] = true));
      setTouched(allTouched);

      const next: Record<string, string> = {};
      let ok = true;
      for (const k of keysToCheck) {
        const e = validateField(k, (formData as any)[k]);
        if (e) { ok = false; next[k] = e; }
      }
      setErrors(next);
      if (!ok) return;

      setLoading(true);
      try {
        await onSubmit(formData);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Para usuarios registrados: validación completa
    const p = formData.profile_code;
    const baseReq = ["first_name", "last_name", "email", "password"] as const;
    const clientRegReq = ["dni", "cuil"] as const;
    const empleadoReq = ["position_code"] as const;

    const keysToCheck: string[] = [...baseReq];
    if (p === "cliente_registrado") keysToCheck.push(...clientRegReq);
    if (p === "empleado") keysToCheck.push(...empleadoReq);
    if (requireFile) keysToCheck.push("file");

    const allTouched = { ...touched };
    keysToCheck.forEach(k => (allTouched[k] = true));
    setTouched(allTouched);

    const next: Record<string, string> = {};
    let ok = true;
    for (const k of keysToCheck) {
      const e = validateField(k, (formData as any)[k]);
      if (e) { ok = false; next[k] = e; }
    }
    setErrors(next);
    if (!ok) return;

    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    errors,
    focusedField,
    loading,
    setFocusedField,
    handleInputChange,
    handleBlur,
    pickImage,
    handleSubmit,
  };
};