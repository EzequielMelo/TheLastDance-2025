import { useState } from "react";
import * as ImagePicker from "expo-image-picker";

export type FormDataType = {
  first_name: string;
  last_name: string;
  profile_code: string;
  position_code: string;
  dni: string;
  cuil: string;
  email: string;
  password: string;
  file: File | null;
  file_uri?: string;
};

export const useRegisterForm = (
  onSubmit: (data: FormDataType) => Promise<void>,
) => {
  const [formData, setFormData] = useState<FormDataType>({
    first_name: "",
    last_name: "",
    profile_code: "",
    position_code: "",
    dni: "",
    cuil: "",
    email: "",
    password: "",
    file: null,
    file_uri: undefined,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [focusedField, setFocusedField] = useState("");
  const [loading, setLoading] = useState(false);

  const validateField = (field: string, value: string | File | null) => {
    switch (field) {
      case "first_name":
      case "last_name":
        if (!value || (typeof value === "string" && value.trim() === ""))
          return "Campo obligatorio";
        break;
      case "email":
        if (
          !value ||
          (typeof value === "string" &&
            !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value))
        )
          return "Email inválido";
        break;
      case "password":
        if (!value || (typeof value === "string" && value.length < 6))
          return "Mínimo 6 caracteres";
        break;
      case "file":
        if (!value || !(value instanceof File))
          return "Debes seleccionar una imagen";
        break;
      case "profile_code":
        if (!value || value === "") return "Seleccione un perfil";
        break;
      case "position_code":
        if (formData.profile_code === "empleado" && (!value || value === ""))
          return "Seleccione un cargo";
        break;
      default:
        return "";
    }
    return "";
  };

  const handleInputChange = (field: string, value: string | File) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const pickImage = async (field: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      alert("Se necesita permiso para acceder a la galería");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const fileName = uri.split("/").pop()!;
      const fileType = `image/${fileName.split(".").pop()}`;
      const file = new File([await fetch(uri).then(r => r.blob())], fileName, {
        type: fileType,
      });

      setFormData(prev => ({ ...prev, file, file_uri: uri }));
      const error = validateField("file", file);
      setErrors(prev => ({ ...prev, file: error }));
    }
  };

  const handleSubmit = async () => {
    const newErrors: { [key: string]: string } = {};
    let valid = true;
    Object.entries(formData).forEach(([key, value]) => {
      const error = validateField(key, value);
      if (error) {
        valid = false;
        newErrors[key] = error;
      }
    });
    setErrors(newErrors);
    if (!valid) return;

    setLoading(true);
    await onSubmit(formData);
    setLoading(false);
  };

  return {
    formData,
    errors,
    focusedField,
    loading,
    setFocusedField,
    handleInputChange,
    pickImage,
    handleSubmit,
  };
};
