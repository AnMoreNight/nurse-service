ontact(BaseModelWithConfig):
    ...<2 lines>...
        email: Optional[EmailStr] = None
  File "/mnt/d/coding/freelance/NurseService/backend/.venv/lib/python3.14/site-packages/pydantic/_internal/_model_construction.py", line 242, in __new__
    set_model_fields(cls, config_wrapper=config_wr    apper, ns_resolver=ns_resolver)  
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^  
  File "/mnt/d/coding/freelance/NurseService/backend/.venv/lib/python3.14/site-packages/pydantic/_internal/_model_construction.py", line 566, in set_model_fields     
    fields, class_vars = collect_model_fields(cls, config_wrapper, ns_resolver, typevars_map=typevars_map)
                         ~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/mnt/d/coding/freelance/NurseService/backend/.venv/lib/python3.14/site-packages/pydantic/_internal/_fields.py", line 256, in collect_model_fields
    type_hints = _typing_extra.get_model_type_hints(cls, ns_resolver=ns_resolver)  
  File "/mnt/d/coding/freelance/NurseService/backend/.venv/lib/python3.14/site-packages/pydantic/_internal/_typing_extra.py", line 350, in get_model_type_hints       
    hints[name] = try_eval_type(value, globalns, localns)
                  ~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/mnt/d/coding/freelance/NurseService/backend/.venv/lib/python3.14/site-packages/pydantic/_internal/_typing_extra.py", line 404, in try_eval_type
    return eval_type_backport(value, globalns, localns), True
           ~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/mnt/d/coding/freelance/NurseService/backend/.venv/lib/python3.14/site-packages/pydantic/_internal/_typing_extra.py", line 462, in eval_type_backport
    assert isinstance(value, typing.ForwardRef)
           ~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError
^C
uv pip install -e '.[email]'