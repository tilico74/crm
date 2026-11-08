from rest_framework.pagination import PageNumberPagination


class Paginacao(PageNumberPagination):
    """25 por página; o front-end pede mais no "Ver mais registros", como na MarketUP."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500
