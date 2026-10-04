import DriverMapView from "@/components/DriverMapView";
import LoginScreen from "@/components/login-screen";
import { useState } from "react";
import PanelAdminScreen from "./admin/grupos/index";

type Rol = "chofer" | "admin";

export default function HomeScreen() {
  const [sesionIniciada, setSesionIniciada] = useState(false);
  const [rol, setRol] = useState<Rol | null>(null);

  if (!sesionIniciada) {
    return (
      <LoginScreen
        onLoginExitoso={(rolElegido: Rol) => {
          setRol(rolElegido);
          setSesionIniciada(true);
        }}
      />
    );
  }

  if (rol === "admin") {
    return <PanelAdminScreen />;
  }

  return <DriverMapView />;
}
