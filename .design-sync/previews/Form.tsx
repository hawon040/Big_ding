import { useForm } from "react-hook-form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  Input,
  Button,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  width: 340,
};

export function Default() {
  const form = useForm({ defaultValues: { nickname: "" } });
  return (
    <div style={stage}>
      <Form {...form}>
        <form style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FormField
            control={form.control}
            name="nickname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>닉네임</FormLabel>
                <FormControl>
                  <Input placeholder="닉네임을 입력하세요" {...field} />
                </FormControl>
                <FormDescription>
                  다른 사용자에게 표시되는 이름입니다.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">저장</Button>
        </form>
      </Form>
    </div>
  );
}
