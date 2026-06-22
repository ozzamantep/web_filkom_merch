import { ShoppingBag } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@frontend/components/ui/button";
import { useCart } from "@frontend/hooks/use-cart";

export function CartButton() {
  const { getTotalItems } = useCart();
  const totalItems = getTotalItems();

  return (
    <Link to="/checkout">
      <Button variant="ghost" size="icon" className="relative">
        <ShoppingBag className="h-5 w-5" />
        {totalItems > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {totalItems}
          </span>
        )}
      </Button>
    </Link>
  );
}
