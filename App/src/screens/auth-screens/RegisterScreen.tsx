import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, ToastAndroid } from "react-native";
import { ChefHat, IdCardIcon, Mail, Lock, Eye, EyeOff, User, ImagePlus } from "lucide-react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import FormLayout from "../../Layouts/formLayout";
import { useAuthActions } from "../../auth/useAuthActions";

type Props = NativeStackScreenProps<RootStackParamList, "Registro">;

export const RegisterScreen = ({ navigation }: Props) => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    profile_code: "",
    position_code: "",
    dni: "",
    cuil: "",
    email: "",
    password: "",
    imageUri: undefined as string | undefined,
    imageName: undefined as string | undefined,
    imageType: undefined as string | undefined,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<string>("");

  const { actionLoading, actionError, handleRegister: register } = useAuthActions();

  useEffect(() => {
    if (actionError) {
      ToastAndroid.show(actionError, ToastAndroid.LONG);
    }
  }, [actionError]);

  const setField = (k: string, v: any) => setFormData(prev => ({ ...prev, [k]: v }));

  const validate = (k: string, v: any) => {
    switch (k) {
      case "first_name":
      case "last_name":
      case "dni":
      case "cuil":
        return !v ? "Campo obligatorio" : "";
      case "email":
        return !v ? "Email inválido" : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Email inválido";
      case "password":
        return !v || v.length < 6 ? "Mínimo 6 caracteres" : "";
      case "profile_code":
        return !v ? "Seleccione un perfil" : "";
      case "position_code":
        return formData.profile_code === "empleado" && !v ? "Seleccione un cargo" : "";
      case "file":
        return !formData.imageUri ? "Debes seleccionar una imagen" : "";
      default:
        return "";
    }
  };

  const onPickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      ToastAndroid.show("Se necesita permiso para acceder a la galería", ToastAndroid.LONG);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as any, // RN: evitar warning
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      const uri = a.uri;
      const fileName = a.fileName || uri.split("/").pop() || "image.jpg";
      const ext = (fileName.split(".").pop() || "jpg").toLowerCase();
      const type = ext === "png" ? "image/png" : "image/jpeg";
      setFormData(prev => ({ ...prev, imageUri: uri, imageName: fileName, imageType: type }));
      setErrors(prev => ({ ...prev, file: "" }));
      ToastAndroid.show("Imagen seleccionada ✔️", ToastAndroid.SHORT);
    }
  };

  const onSubmit = async () => {
    const fields = ["first_name","last_name","email","password","dni","cuil","profile_code","file"];
    if (formData.profile_code === "empleado") fields.push("position_code");

    const nextErrors: Record<string, string> = {};
    let ok = true;
    for (const k of fields) {
      const e = validate(k, (formData as any)[k]);
      if (e) { ok = false; nextErrors[k] = e; }
    }
    setErrors(nextErrors);
    if(!ok){
      ToastAndroid.show("Revisá los campos resaltados", ToastAndroid.SHORT);
      return;
    }
      
    const fd = new FormData();
    fd.append("first_name", formData.first_name);
    fd.append("last_name", formData.last_name);
    fd.append("email", formData.email);
    fd.append("password", formData.password);
    fd.append("dni", formData.dni);
    fd.append("cuil", formData.cuil);
    fd.append("profile_code", formData.profile_code);
    if (formData.profile_code === "empleado" && formData.position_code)
      fd.append("position_code", formData.position_code);
    if (formData.imageUri) {
      fd.append("file", {
        uri: formData.imageUri,
        name: formData.imageName || "profile.jpg",
        type: formData.imageType || "image/jpeg",
      } as any);
    }

    const result = await register(fd);
    if (result?.success) {
      ToastAndroid.show("¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.", ToastAndroid.LONG);
      navigation.navigate("Login");
    }
  };

  return (
    <FormLayout
      title="Únete a Nosotros"
      subtitle="Crea tu cuenta en Last Dance"
      icon={<ChefHat size={50} color="#d4af37" strokeWidth={1.5} />}
      submitLabel="Crear Cuenta"
      onSubmit={onSubmit}
      loading={actionLoading}
      bottomText="¿Ya tienes cuenta?"
      bottomLinkText="Inicia Sesión"
      onBottomLinkPress={() => navigation.goBack()}
    >
      {/* Nombre */}
      <View className="mb-4">
        <View className={`flex-row items-center h-13 rounded-xl border px-4 bg-white/10 border-white/20 ${focused==="first_name"?"border-[#d4af37] bg-[#d4af37]/10":""}`}>
          <User size={20} color={focused==="first_name"?"#d4af37":"#888"} />
          <TextInput
            className="flex-1 text-white text-base py-4"
            placeholder="Nombre"
            placeholderTextColor="#888"
            value={formData.first_name}
            onChangeText={v=>setField("first_name",v)}
            onFocus={()=>setFocused("first_name")}
            onBlur={()=>setFocused("")}
          />
        </View>
        {!!errors.first_name && <Text className="text-red-500 text-sm mt-1">{errors.first_name}</Text>}
      </View>

      {/* Apellido */}
      <View className="mb-4">
        <View className={`flex-row items-center h-13 rounded-xl border px-4 bg-white/10 border-white/20 ${focused==="last_name"?"border-[#d4af37] bg-[#d4af37]/10":""}`}>
          <User size={20} color={focused==="last_name"?"#d4af37":"#888"} />
          <TextInput
            className="flex-1 text-white text-base py-4"
            placeholder="Apellido"
            placeholderTextColor="#888"
            value={formData.last_name}
            onChangeText={v=>setField("last_name",v)}
            onFocus={()=>setFocused("last_name")}
            onBlur={()=>setFocused("")}
          />
        </View>
        {!!errors.last_name && <Text className="text-red-500 text-sm mt-1">{errors.last_name}</Text>}
      </View>

      {/* Email */}
      <View className="mb-4">
        <View className={`flex-row items-center h-13 rounded-xl border px-4 bg-white/10 border-white/20 ${focused==="email"?"border-[#d4af37] bg-[#d4af37]/10":""}`}>
          <Mail size={20} color={focused==="email"?"#d4af37":"#888"} />
          <TextInput
            className="flex-1 text-white text-base py-4"
            placeholder="Correo electrónico"
            placeholderTextColor="#888"
            value={formData.email}
            onChangeText={v=>setField("email",v)}
            keyboardType="email-address"
            autoCapitalize="none"
            onFocus={()=>setFocused("email")}
            onBlur={()=>setFocused("")}
          />
        </View>
        {!!errors.email && <Text className="text-red-500 text-sm mt-1">{errors.email}</Text>}
      </View>

      {/* Perfil */}
      <View className="mb-4">
        <View className={`flex-row items-center h-13 rounded-xl border px-4 bg-white/10 border-white/20 ${focused==="profile_code"?"border-[#d4af37] bg-[#d4af37]/10":""}`}>
          <User size={20} color={"#888"} />
          <Picker
            selectedValue={formData.profile_code}
            style={{ flex: 1, color: formData.profile_code ? "white" : "#aaa" }}
            dropdownIconColor="#888"
            onFocus={()=>setFocused("profile_code")}
            onBlur={()=>setFocused("")}
            onValueChange={v=>{
              setField("profile_code", v);
              if (v !== "empleado") setField("position_code","");
            }}
          >
            <Picker.Item label="Seleccione uno" value="" enabled={false} color="#aaa" />
            <Picker.Item label="Dueño" value="dueno" />
            <Picker.Item label="Supervisor" value="supervisor" />
            <Picker.Item label="Empleado" value="empleado" />
            <Picker.Item label="Cliente" value="cliente_registrado" />
          </Picker>
        </View>
        {!!errors.profile_code && <Text className="text-red-500 text-sm mt-1">{errors.profile_code}</Text>}
      </View>

      {/* Cargo (solo empleado) */}
      {formData.profile_code === "empleado" && (
        <View className="mb-4">
          <View className={`flex-row items-center h-13 rounded-xl border px-4 bg-white/10 border-white/20 ${focused==="position_code"?"border-[#d4af37] bg-[#d4af37]/10":""}`}>
            <User size={20} color={"#888"} />
            <Picker
              selectedValue={formData.position_code}
              style={{ flex: 1, color: formData.position_code ? "white" : "#aaa" }}
              dropdownIconColor="#888"
              onFocus={()=>setFocused("position_code")}
              onBlur={()=>setFocused("")}
              onValueChange={v=>setField("position_code", v)}
            >
              <Picker.Item label="Seleccione uno" value="" enabled={false} color="#aaa" />
              <Picker.Item label="Maître" value="maitre" />
              <Picker.Item label="Mozo" value="mozo" />
              <Picker.Item label="Cocinero" value="cocinero" />
              <Picker.Item label="Bartender" value="bartender" />
            </Picker>
          </View>
          {!!errors.position_code && <Text className="text-red-500 text-sm mt-1">{errors.position_code}</Text>}
        </View>
      )}

      {/* DNI */}
      <View className="mb-4">
        <View className={`flex-row items-center h-13 rounded-xl border px-4 bg-white/10 border-white/20 ${focused==="dni"?"border-[#d4af37] bg-[#d4af37]/10":""}`}>
          <IdCardIcon size={20} color={focused==="dni"?"#d4af37":"#888"} />
          <TextInput
            className="flex-1 text-white text-base py-4"
            placeholder="DNI"
            placeholderTextColor="#888"
            value={formData.dni}
            onChangeText={v=>setField("dni",v)}
            keyboardType="phone-pad"
            onFocus={()=>setFocused("dni")}
            onBlur={()=>setFocused("")}
          />
        </View>
        {!!errors.dni && <Text className="text-red-500 text-sm mt-1">{errors.dni}</Text>}
      </View>

      {/* CUIL */}
      <View className="mb-4">
        <View className={`flex-row items-center h-13 rounded-xl border px-4 bg-white/10 border-white/20 ${focused==="cuil"?"border-[#d4af37] bg-[#d4af37]/10":""}`}>
          <IdCardIcon size={20} color={focused==="cuil"?"#d4af37":"#888"} />
          <TextInput
            className="flex-1 text-white text-base py-4"
            placeholder="CUIL"
            placeholderTextColor="#888"
            value={formData.cuil}
            onChangeText={v=>setField("cuil",v)}
            keyboardType="phone-pad"
            onFocus={()=>setFocused("cuil")}
            onBlur={()=>setFocused("")}
          />
        </View>
        {!!errors.cuil && <Text className="text-red-500 text-sm mt-1">{errors.cuil}</Text>}
      </View>

      {/* Password */}
      <View className="mb-4">
        <View className={`flex-row items-center h-13 rounded-xl border px-4 bg-white/10 border-white/20 ${focused==="password"?"border-[#d4af37] bg-[#d4af37]/10":""}`}>
          <Lock size={20} color={focused==="password"?"#d4af37":"#888"} />
          <TextInput
            className="flex-1 text-white text-base py-4 pr-10"
            placeholder="Contraseña"
            placeholderTextColor="#888"
            value={formData.password}
            onChangeText={v=>setField("password",v)}
            secureTextEntry={!showPassword}
            onFocus={()=>setFocused("password")}
            onBlur={()=>setFocused("")}
          />
          <TouchableOpacity onPress={()=>setShowPassword(p=>!p)} className="absolute right-4 p-1">
            {showPassword ? <EyeOff size={20} color="#888" /> : <Eye size={20} color="#888" />}
          </TouchableOpacity>
        </View>
        {!!errors.password && <Text className="text-red-500 text-sm mt-1">{errors.password}</Text>}
      </View>

      {/* Imagen */}
      <View className="mb-4">
        <TouchableOpacity
          onPress={onPickImage}
          className={`flex-row items-center h-13 rounded-xl border px-4 py-4 bg-white/10 border-white/20 ${focused==="file"?"border-[#d4af37] bg-[#d4af37]/10":""}`}
          onFocus={()=>setFocused("file")}
          onBlur={()=>setFocused("")}
        >
          <ImagePlus size={20} color="#888" />
          {formData.imageUri ? (
            <Image source={{ uri: formData.imageUri }} className="h-10 w-10 rounded-lg ml-3" />
          ) : (
            <Text className="flex-1 text-white text-base ml-3">Selecciona una imagen</Text>
          )}
        </TouchableOpacity>
        {!!errors.file && <Text className="text-red-500 text-sm mt-1">{errors.file}</Text>}
      </View>
    </FormLayout>
  );
};
