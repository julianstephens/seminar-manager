import { AUTH_TOKEN_KEY } from "@/utils";
import { Box, Button } from "@chakra-ui/react";
import { useNavigate } from "react-router";

const HomePage = () => {
  const navigate = useNavigate();
  return (
    <Box minH="100vh" bg="black" color="white">
      <Button
        position="absolute"
        top={4}
        right={4}
        variant="outline"
        onClick={() => {
          sessionStorage.removeItem(AUTH_TOKEN_KEY);
          navigate("/");
        }}
      >
        Log out
      </Button>
    </Box>
  );
};

export default HomePage;
