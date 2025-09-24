import { useState } from "react";
import * as ImagePicker from "expo-image-picker";

export type RNImage = { uri: string; name: string; type: string } | null;
export type RegisterMode = "anon" | "registered";

export type FormDataType = {
  profile_code: string;
  position_code: string;
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
) => {
  const [formData, setFormData] = useState<FormDataType>(() =>
    mode === "anon"
      ? {
          mode,
          first_name: "",
          last_name: "",
          dni: "",
          cuil: "",
          email: "",
          password: "",
          profile_code: "cliente_anonimo",
          position_code: "",
          file: null,
          file_uri: undefined,
        }
      : {
          mode,
          first_name: "",
          last_name: "",
          dni: "",
          cuil: "",
          email: "",
          password: "",
          profile_code: "cliente_registrado",
          position_code: "",
          file: null,
          file_uri: undefined,
        }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [focusedField, setFocusedField] = useState("");
  const [loading, setLoading] = useState(false);

  const validateField = (field: string, value: any) => {
    if (field === "file") {
      return formData.file ? "" : "Debes seleccionar una imagen";
    }

    if (mode === "anon") {
      switch (field) {
        case "first_name":
        case "last_name":
          return !value || String(value).trim().length < 2 ? "Mínimo 2 caracteres" : "";
        default:
          return "";
      }
    }

    switch (field) {
      case "first_name":
      case "last_name":
      case "dni":
      case "cuil":
        return !value ? "Campo obligatorio" : "";
      case "email":
        return !value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? "Email inválido" : "";
      case "password":
        return !value || String(value).length < 6 ? "Mínimo 6 caracteres" : "";
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
      quality: 0.7,
    });

    if (!result.canceled) {
      const a = result.assets[0];
      const uri = a.uri;
      const name = a.fileName || uri.split("/").pop() || `img_${Date.now()}.jpg`;
      const ext = (name.split(".").pop() || "jpg").toLowerCase();
      const type = ext === "png" ? "image/png" : "image/jpeg";

      const rnImage = { uri, name, type };
      setFormData(prev => ({ ...prev, file: rnImage, file_uri: uri }));
      // marcar file como tocado y validar
      setTouched(prev => ({ ...prev, file: true }));
      const error = validateField("file", rnImage);
      setErrors(prev => ({ ...prev, file: error }));
    }
  };

  const handleSubmit = async () => {
    const keysToCheck =
      mode === "anon"
        ? ["first_name", "last_name", "file"]
        : ["first_name", "last_name", "dni", "cuil", "email", "password", "file"];

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
